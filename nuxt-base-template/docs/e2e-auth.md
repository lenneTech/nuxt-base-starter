# Auth E2E Suite — prerequisites and configuration scenarios

How to run `tests/e2e/auth-lifecycle.spec.ts` and `tests/e2e/auth-feature-order.spec.ts`, and
against which backend configurations.

This lived in the two spec file headers until it was deleted by an over-broad regex during a
refactor — silently, because a typecheck does not read comments and nothing else in the repo
carried the knowledge. It lives here now so the next refactor of those files cannot take it
with them.

## Requirements

| Component | Expectation                                                                                  |
| --------- | -------------------------------------------------------------------------------------------- |
| API       | `nest-server-starter` **or** `nest-server` on port 3000, **stdout redirected to a log file** |
| Frontend  | this template on port 3001                                                                   |
| MongoDB   | reachable on `localhost:27017`                                                               |

The stdout redirect is not optional: email-verification tokens are extracted from the server
log, because the token is a **stateless JWT** that is never written to the database (Better
Auth signs it on send and verifies it by signature at redemption — there is no row to read).

`findVerificationToken()` reads both log formats. From nest-server 12.6.0 on the link carries the
token sealed (a JWE nobody can read), and the line names the account by
`UserKey: <16 hex>`, the start of the SHA-256 of the trimmed, lower-cased address; a line with a
`UserKey` is matched by it and nothing else. Before 12.6.0 the line carries Better-Auth's readable
JWT, matched by the address in its payload. 12.6.0 prints the line only in the `local`, `ci` and
`e2e` environments, so an API started otherwise leaves the suite without tokens.

12.6.0 also counts tokens it cannot read at `POST /iam/resend-verification-email` per client
address, 10 an hour per API process. `auth-verify-email-url.spec.ts` sends one per run, so against
an API that keeps running it takes the refusal path from the 11th run in an hour and marks it with
the annotation `rate-limited`. Restart the API, or use `lt dev test`, which starts a fresh one, to
run the address-field path again.

### Where the log is looked for

`tests/e2e/helpers/auth-backend.ts` → `readServerLog()` concatenates every candidate it finds,
in this order:

1. `$NEST_SERVER_LOG`, when set
2. `.lt-dev/api.test.log` — written by `lt dev test`
3. `.lt-dev/api.log` — written by `lt dev up`
4. `/tmp/nest-server.log` — the classic default

2 and 3 are searched upward from the working directory, so a `lt dev` stack at the repo root is
found from inside `nuxt-base-template/`.

> **The log contains live bearer credentials.** A verification token grants email verification
> for that account to whoever holds it. Do not upload `.lt-dev/api*.log` or `/tmp/nest-server.log`
> as a CI artefact, and do not ship them to a log aggregator.

### Environment variables

All optional — each falls back to the classic local default.

| Variable                           | Falls back to                           | Used for                                              |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| `NEST_SERVER_LOG`                  | the candidate list above                | explicit log location                                 |
| `NUXT_PUBLIC_API_URL` / `API_URL`  | `http://localhost:3000`                 | API base                                              |
| `NUXT_API_URL`                     | unset (SSR uses the public API base)    | SSR address check (see below)                         |
| `NUXT_PUBLIC_SITE_URL` / `APP_URL` | `http://localhost:3001`                 | app base                                              |
| `NSC__MONGOOSE__URI` / `MONGO_URI` | `mongodb://127.0.0.1/nest-server-local` | test-data reset                                       |
| `E2E_EXPECT_AUTH_MODE`             | not checked                             | auth mode of the password sign-in (`cookie` or `jwt`) |

Under `lt dev up` / `lt dev test` these are set for you via the `.lt-dev/.env` bridge, so the
same suite runs unchanged against classic ports, a `lt dev` session, and CI.

**The SSR address check needs `NUXT_API_URL` with a host of its own.**
`tests/e2e/ssr-internal-api-url.spec.ts` renders every page and fails when the HTML contains the host
of `NUXT_API_URL`, the address the app server uses during SSR. On a cluster that is an internal name
no browser resolves, so a URL built from it for an `<img src>` or a link is dead. The spec can only
tell it from the public address when the two differ, so the CI job that runs the suite sets
`NUXT_API_URL=http://127.0.0.1:3000` next to `NUXT_PUBLIC_API_URL=http://localhost:3000`: here
`.github/workflows/test.yml`, job `e2e-auth`; in an `lt fullstack` monorepo the root CI
(`.gitlab-ci.yml` job `app:test`, `.github/workflows/test.yml` job `app-test`), since no CI runs
`projects/app/.github/`. A local run does the same. With one address for both (`lt dev up`, a CI job
that sets both to `localhost`, or `NUXT_API_URL` unset) it skips, and the pipeline stays green
without having checked anything.

### An empty database is its own state

The suite assumes an installation that is **past first-run setup**. With zero users the app
routes every visitor to `/auth/setup` instead of `/auth/login`, and specs asserting on the
login redirect fail against a redirect that is entirely correct. `resetTestData()` does not
help here — it deletes, it never seeds.

Migrations do not cover it either: they build the schema, while the first admin is an
application-level decision. Create one before the run:

```bash
curl -X POST http://localhost:3000/system-setup/init \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"<min 8 chars>","name":"Admin"}'
```

The endpoint refuses once any user exists, so it is safe to leave in a setup script. Locally
this rarely bites, because a development database has users in it from the first day — which
is exactly why it stayed unnoticed until the suite first ran against a fresh CI database.

## Backend options

Any of these can serve the API on port 3000. Each needs its `betterAuth` section configured
per the scenario you want to exercise.

Start it with `PLAYWRIGHT=true`, as the CI job does. nest-server (11.25.6 or later) then reads a
user's roles fresh on every request; otherwise it answers them from a 15-second cache. A role that
`grantAdminRole` writes into the database does not reach that cache, so `auth-admin-role.spec.ts`
fails against an API started without it: the new sign-in still carries no admin role. Under
`lt dev up` and `lt dev test` the cache is off already (`LT_DEV_ACTIVE`).

**Option A — `nest-server-starter` (standalone template)**

```bash
cd <nest-server-starter>
PLAYWRIGHT=true npm run start > /tmp/nest-server.log 2>&1 &
```

Config: `src/config.env.ts` → `betterAuth`

**Option B — `nest-server` (direct, e.g. while developing the framework)**

```bash
cd <nest-server>
PLAYWRIGHT=true npm run start > /tmp/nest-server.log 2>&1 &
```

Config: `src/config.env.ts` → `betterAuth`

**Option C — a fullstack project (`lt fullstack init`)**

```bash
cd projects/api
PLAYWRIGHT=true npm run start > /tmp/nest-server.log 2>&1 &
```

Config: `projects/api/src/config.env.ts` → `betterAuth`

**Option D — CI (GitHub Actions), automatic**

The `e2e-auth` job in `.github/workflows/test.yml` does all of the above on every push and
pull request: a `mongo:7` service, `lenneTech/nest-server-starter@main` checked out into
`api/`, built, migrated and started with its stdout redirected to `$NEST_SERVER_LOG`, then
this suite against it. Playwright starts the app itself via its `webServer` block.

It is **blocking**, and deliberately so. This is the only job in that pipeline that exercises
behaviour across the client/server boundary — everything else proves this repo is internally
consistent, which is exactly the property that stayed green while a better-auth version split
broke every 2FA activation in every fullstack project. A non-blocking gate without a
visibility path is worse than no gate: it keeps looking like a net while catching nothing.

The job never uploads `$NEST_SERVER_LOG` as an artefact — see the credentials warning above.
Only the Playwright report is kept, and only on failure.

If the job ever gets too slow to block on, shard it the way lt-monorepo's `app:test` does
(`parallel: 2`) rather than demoting it to advisory.

### The AI module (`ai-visibility.spec.ts`, `ai-settings-mcp-confirmation.spec.ts`, `ai-prompts-include-disabled.spec.ts`)

The app shows its AI pages only while the API runs its AI module, read from the public
`GET /ai/status` (nest-server 12.3.1 or later): 200 `{ mcp }` while it runs, 404 while it is off.
`nest-server-starter` leaves the module off: its `config.env.ts` has no `ai` block. Two variables
switch the module and its MCP server on, with any of the options above:

```bash
NSC__AI__ENCRYPTION_SECRET=<any 32 characters> NSC__AI__MCP__ENABLED=true PLAYWRIGHT=true npm run start > /tmp/nest-server.log 2>&1 &
```

Check it with `curl -s localhost:3000/ai/status`: `{"mcp":true}` means both are on, 404 means the
module is off or nest-server is older.

- `ai-visibility.spec.ts` checks whichever state the API is in: with the module on, the AI links
  show and `/app/settings/ai` opens; with it off, there are no links and the route goes to `/app`.
  A run that sets `NSC__AI__ENCRYPTION_SECRET` expects it on and fails on a 404.
- `ai-settings-mcp-confirmation.spec.ts` needs the MCP server, because the card appears only with
  it. It skips without one, unless the run sets `NSC__AI__MCP__ENABLED`: then it fails.
- `ai-prompts-include-disabled.spec.ts` needs the module. It checks that every load of
  `/app/settings/ai-prompts` asks for the disabled prompts too (`?includeDisabled=true`), the reload
  after a save included, and that the chat picker on `/app/ai` never does. Whether the page then
  shows a disabled prompt depends on the API: nest-server 12.7.0 lists it, an older one ignores the
  parameter, which the spec notes as the annotation `api-before-12.7.0`. It skips without the module,
  unless the run sets `NSC__AI__ENCRYPTION_SECRET`: then it fails.

Both `e2e-auth` jobs (this repo's root workflow and the template's own) set both variables. The
trigger is deliberately not `CI`: an lt-monorepo's `app:test` runs this suite with `CI=true`
against an API whose module is off, where `ai-visibility` checks the off state and the MCP and
prompt specs skip.

## Configuration scenarios

The suite reads the feature flags from `GET /iam/features` and adapts: it skips steps that do not
apply. The auth mode it cannot read there. `jwt` in that answer reports the JWT plugin, which is on
by default in both modes, so `jwt=true` does not mean "JWT mode". The mode is a server setting, the
top-level `cookies` of the nest-server config (`NSC__COOKIES=false` for the JWT mode). There is no
`betterAuth.cookies`, and `NSC__BETTER_AUTH__COOKIES` changes nothing: a run switched that way was
a cookie run.

Declare the mode a run expects with `E2E_EXPECT_AUTH_MODE=cookie` or `E2E_EXPECT_AUTH_MODE=jwt`.
`auth-lifecycle.spec.ts` then checks it after the password sign-in of step 8 and fails on a
mismatch. The signal is the API's httpOnly session cookie (`…session_token`): the sign-in sets it
in the cookie mode and sets no cookie at all in the JWT mode (measured on nest-server 12.6.0). Not
the app's `lt-auth-state`: its `authMode` turns to `jwt` in the cookie mode too, once
`/iam/token` hands out a JWT. Without the variable the spec prints the mode it saw and checks
nothing.

For full coverage, run the suite against all four. Restart the backend after each config change.

### Scenario 1 — Zero config (everything enabled)

Default `nest-server-starter` config, no changes needed. `E2E_EXPECT_AUTH_MODE=cookie`.

Expected: auth mode `cookie`, `jwt=true`, `emailVerification=true`, `signUpChecks=true`,
`twoFactor=true`, `passkey=true`

### Scenario 2 — Cookies, no verification or checks

```ts
betterAuth: {
  emailVerification: false,
  signUpChecks: false,
}
```

`E2E_EXPECT_AUTH_MODE=cookie`. Expected: auth mode `cookie`, `jwt=true`, `emailVerification=false`,
`signUpChecks=false`, `twoFactor=true`, `passkey=true`

Effect: no terms checkbox, no verification step, direct login after registration.

### Scenario 3 — JWT mode, everything else enabled

```ts
cookies: false, // top level, next to `betterAuth`; or NSC__COOKIES=false
```

`E2E_EXPECT_AUTH_MODE=jwt`. Expected: auth mode `jwt`, `jwt=true`, `emailVerification=true`,
`signUpChecks=true`, `twoFactor=true`, `passkey=true`

Effect: auth via JWT instead of cookies, all features active.

Until nest-server 12.7.0 the JWT mode works same-origin only: start the app with
`NUXT_PUBLIC_API_PROXY=true`, so it reaches the API through its own origin. Cross-origin it needs
CORS with credentials, which comes with 12.7.0.

### Scenario 4 — JWT mode, no verification or checks

```ts
cookies: false, // top level; or NSC__COOKIES=false
betterAuth: {
  emailVerification: false,
  signUpChecks: false,
}
```

`E2E_EXPECT_AUTH_MODE=jwt`. Expected: auth mode `jwt`, `jwt=true`, `emailVerification=false`,
`signUpChecks=false`, `twoFactor=true`, `passkey=true`. The same-origin note of scenario 3 applies.

## Running all four (for an agent or CI)

For each scenario:

1. Set the config for your backend option: the top-level `cookies` for the mode, the
   `betterAuth` section for verification and checks.
2. Restart the backend:
   ```bash
   pkill -f "nest-server" 2>/dev/null
   cd <backend-path> && PLAYWRIGHT=true npm run start > /tmp/nest-server.log 2>&1 &
   ```
3. Wait until it answers: `curl -s http://localhost:3000/ > /dev/null`
4. Run: `E2E_EXPECT_AUTH_MODE=<cookie|jwt> npx playwright test tests/e2e/auth-lifecycle.spec.ts`
5. Read the configuration banner in the output to confirm which scenario was detected:
   ```
   ╔═════════════════════════════╗
   ║  Szenario X: <description>  ║
   ╚═════════════════════════════╝
   ```
6. **Restore the config to its original state** once all four have run.

## Locator conventions

Prefer accessible-name locators — `getByRole('textbox', { name: … })`, `getByLabel(…)`. They
describe the field the way a user and a screen reader find it, and they survive markup changes.

**Never assert on a generated `for` or `id` value.** Those come from Vue's `useId()` and are
neither stable across renders nor meaningful. Since `@lenne.tech/nuxt-extensions` 1.13.0 they
are also actively repaired after mount: a client plugin re-points `<label for>` attributes whose
target no longer resolves, which is what makes the name-based locators above dependable in the
first place. An assertion pinned to a literal `for` value would be pinning the repaired result.

## Test data

`resetTestData(email)` removes a user and everything Better Auth hung off it — sessions,
accounts, verifications, passkeys, 2FA rows — plus the user's AI settings (`aiUserSettings`). Without it an auth suite starts failing on its
_second_ run rather than its first.

It deletes by exact email match and refuses anything that is not an `@test.com` address, and it
refuses a non-loopback `MONGO_URI` unless `E2E_ALLOW_REMOTE_DB=true` is set explicitly. Use
`generateTestUser()` from `@lenne.tech/nuxt-extensions/testing` to get a correctly namespaced,
per-run-unique address.

`grantAdminRole(email)` gives such a user the admin role (`users.roles`), under the same two
guards. A test user cannot grant itself a role through the API, so this is the suite's only way to
an admin besides the setup. The app reads the roles at sign-in: sign in again after the call, against
an API started with `PLAYWRIGHT=true` (see "Backend options"), whose role cache would otherwise hide
the new role for 15 seconds.
`auth-admin-role.spec.ts` uses it to walk `/app/admin` without and with the role, and fails on any
request to `/iam/admin/*` (the template switches Better Auth's admin client plugin off, because
nest-server serves no admin routes).