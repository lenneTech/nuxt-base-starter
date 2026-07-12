#!/usr/bin/env bash
# Verify the built Nuxt server boots and stays up, then exit cleanly.
#
# Previously this script also streamed logs via a parallel `tail -f` and waited
# on both PIDs on EXIT. On macOS / bash that pattern hangs intermittently:
# `tail -f` does not always honor SIGTERM while blocked on the kqueue file
# watch, so `wait $TAIL_PID` blocks indefinitely and the surrounding
# `pnpm run check` never returns. We now skip the live stream and print the
# relevant log excerpt at the end instead.

set -e

LOG_FILE=$(mktemp -t nuxt-check-server.XXXXXX)

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    # SIGTERM first, then SIGKILL if still alive after ~2s. We do NOT `wait`
    # on the child — it was the original hang. Nitro can take a moment to
    # unwind its listeners; the escalation gives it that moment.
    kill "$SERVER_PID" 2>/dev/null || true
    for _ in 1 2 3 4; do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

# Allocate an ephemeral port by binding :0 then closing it. Strip ANSI color
# escape sequences from the output — under a workspace runner like lerna/nx,
# stdout may be wrapped and color codes ("\x1b[33m...\x1b[39m") injected. Those
# would land in the port and crash Nitro with
# `ERR_SOCKET_BAD_PORT options.port ... Received type string ('<codes>50604<codes>')`.
# A naïve `tr -cd '0-9'` makes it worse because the color codes contain digits
# (33, 39) themselves; sed only on the escape pattern keeps the port digits intact.
alloc_port() {
  node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>console.log(p));});" | sed $'s/\x1b\\[[0-9;]*m//g' | tr -d '[:space:]'
}

# Pick a free port so the check passes regardless of what is running on 3000/3001
# (sister API dev server, another nuxt instance, …). Use NITRO_PORT rather than
# PORT — Nitro 2.13.3 reads PORT as a string without parseInt and feeds it
# straight into net.Server#listen.
FREE_PORT=$(alloc_port)
echo "Using free port: $FREE_PORT"

# The built server never reads .env, so without an API URL the SSR data layer
# retries forever and exhausts the heap on the first request. Point it at a
# just-released ephemeral port — bound then immediately closed, so it is
# guaranteed refusing connections (unlike the fixed IANA discard port 9, which
# an active discard service would leave open and let the SSR fetch hang). Fetches
# then fail fast and the page still renders its error state. Re-roll if the kernel
# hands back the live server's port (rare) or nothing, else the "closed" URL would
# point at the running server and the SSR fetch would loop back instead of failing.
CLOSED_PORT=$(alloc_port)
closed_port_tries=0
while [[ -z "$CLOSED_PORT" || "$CLOSED_PORT" == "$FREE_PORT" ]]; do
  # Bounded re-roll: an ephemeral-port collision is astronomically rare, so a
  # cap only guards against a pathological kernel/loopback state rather than
  # spinning forever.
  if (( ++closed_port_tries > 10 )); then
    echo "Could not allocate a distinct closed port after 10 attempts" >&2
    exit 1
  fi
  CLOSED_PORT=$(alloc_port)
done
export NUXT_API_URL="${NUXT_API_URL:-http://127.0.0.1:$CLOSED_PORT}"
export NUXT_PUBLIC_API_URL="${NUXT_PUBLIC_API_URL:-$NUXT_API_URL}"

NITRO_PORT=$FREE_PORT node .output/server/index.mjs >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
# Remove from job table so bash does not print "Terminated: 15" on SIGTERM
disown "$SERVER_PID" 2>/dev/null || true

# Booting is not enough. A bundle whose externals are mis-traced (e.g. an
# inlined CJS dependency interop-importing an external `vue`, which has no ESM
# default export) listens happily and then throws on every render. Only an
# actual request catches that, so we render one page before declaring success.
smoke_test() {
  node -e "
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    fetch(process.argv[1], { redirect: 'manual', signal: ctl.signal })
      .then((res) => console.log(res.status))
      .catch(() => console.log('000'))
      .finally(() => clearTimeout(timer));
  " "http://127.0.0.1:$FREE_PORT/" | sed $'s/\x1b\\[[0-9;]*m//g' | tr -d '[:space:]'
}

for _ in $(seq 1 60); do
  if grep -q "Listening on\|Nitro ready\|Local:" "$LOG_FILE" 2>/dev/null; then
    STATUS=$(smoke_test || true)
    # Demand a 2xx render or a 3xx redirect. `/` is the public landing page and
    # renders 200 even with the API down; a 4xx/5xx means the routes are gone or
    # the render threw — exactly the mis-traced-bundle failure this check exists
    # to catch, so it must NOT pass. Matching on the shape is what makes this
    # safe: `[[ "" -ge 500 ]]` coerces the empty string to 0 and would silently
    # pass, and non-numeric output aborts `[[ -ge ]]` outright. The "000"
    # sentinel (request never completed) fails the pattern too, as it should.
    if [[ ! "$STATUS" =~ ^[23][0-9]{2}$ ]]; then
      echo "Server booted but GET / did not render (HTTP ${STATUS:-<no response>}). Last 30 log lines:"
      tail -n 30 "$LOG_FILE"
      exit 1
    fi
    tail -n 5 "$LOG_FILE"
    echo "Server started and rendered GET / with HTTP $STATUS - check complete"
    exit 0
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server process exited unexpectedly. Full log:"
    cat "$LOG_FILE"
    exit 1
  fi
  sleep 1
done

echo "Server failed to start within 60 seconds. Last 30 log lines:"
tail -n 30 "$LOG_FILE"
exit 1
