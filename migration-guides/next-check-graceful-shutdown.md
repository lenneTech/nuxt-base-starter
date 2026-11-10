# Migration Guide: `check` proves the built server shuts down on SIGTERM

The production image starts the app with `CMD ["node", ".output/server/index.mjs"]`, so node runs
as PID 1 in the container. There the kernel discards a signal whose handler is the default: the
server ends on `docker stop` only because Nitro installs a SIGTERM handler that closes it. If that
handler stops working, every stop and deploy waits out the 10 s grace period and then kills the
server, dropping requests in flight. Nothing in `check` noticed.

`scripts/check-server-start.mjs` has an optional step for it, `--graceful-shutdown=<seconds>`. After
the render it sends SIGTERM and requires the server to exit with code 0 within that time. The
server runs with a no-op SIGTERM / SIGINT listener preloaded, as node does as PID 1, so a missing
handler shows as a hang instead of an instant exit. The template's `check` chains pass
`--graceful-shutdown=10`, Docker's default stop grace period. A built Nitro server passes in well
under a second. The step is skipped on Windows, which delivers no SIGTERM. nest-server-starter
carries the same step in its copy of the script.

| Project                                                    | What to do |
| ---------------------------------------------------------- | ---------- |
| Uses the template's `scripts/check-server-start.mjs`       | Steps 1-2  |
| Has its own server-start check, or no `check-server-start` | Nothing    |

No dependency and no API change are needed.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. Take over the script and its tests

Copy these files:

- `scripts/check-server-start.mjs`
- `scripts/check-server-start.d.mts`
- `tests/unit/check-server-start.test.ts`
- `tests/unit/fixtures/server-start/`: `ok.mjs` now handles SIGTERM like Nitro; `no-shutdown.mjs` and
  `shutdown-fails.mjs` are new.

### 2. Pass the flag in the check chains

In `package.json`, end `check:raw`, `check:fix` and `check:naf` with:

```
node scripts/check-server-start.mjs --graceful-shutdown=10
```

The copied test pins this line in all three chains. If your project sets `NITRO_SHUTDOWN_DISABLED`
or runs its own long shutdown work, raise the limit or drop the flag, and change the test with it.

## Check it

`pnpm run check` ends with `server-start` green. Run on its own after a build,
`node scripts/check-server-start.mjs --graceful-shutdown=10` prints "Server shut down cleanly on
SIGTERM".
