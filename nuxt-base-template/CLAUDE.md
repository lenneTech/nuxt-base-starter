# nuxt-base-starter

## Project Overview

Starter template for Nuxt 4 applications using the lenne.tech stack. Used by `lt fullstack init` to scaffold new frontend projects.

## Framework Mode (npm vs. vendor) — read first

This project consumes `@lenne.tech/nuxt-extensions` in one of two modes. Detect it:

- **vendor mode** if `app/core/VENDOR.md` exists → the module is vendored into
  `app/core/` as first-class project code (no npm dependency). Read framework code from
  `app/core/`, not `node_modules/`.
- **npm mode** otherwise → the framework is the `@lenne.tech/nuxt-extensions` dependency.

| Action                                          | vendor mode                                                                                                                                    | npm mode                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Update framework                                | `/lt-dev:frontend:update-nuxt-extensions-core` (also raises npm packages to at least the upstream baseline via `/lt-dev:maintenance:maintain`) | `pnpm update @lenne.tech/nuxt-extensions`  |
| Contribute a generally-useful core fix upstream | `/lt-dev:frontend:contribute-nuxt-extensions-core`                                                                                             | open a PR on `@lenne.tech/nuxt-extensions` |

In vendor mode, `app/core/` mirrors upstream — edit it **only** for changes useful to
every consumer. Project-specific code stays outside `app/core/`. Full details in the
"Framework: @lenne.tech/nuxt-extensions" section below and in `app/core/VENDOR.md`.

**`config.public.*` reads as `unknown`?** Only in vendor-mode projects generated
before the fix. Check yours — this works whatever CLI version made it:

```bash
grep -rn "declare module '@nuxt/schema'" app/core/     # a match means you are affected
```

**Repair:** delete the two `declare module '…/schema'` blocks from
`app/core/runtime/types/module.ts`. Nothing is lost — `ltExtensions` reaches the
consumer through the module's runtime-config defaults, which Nuxt writes into the
generated types either way (verified: `ltExtensions.auth.enabled` stays `boolean`).
New conversions strip them automatically and leave a note in their place. **Re-check
after every core update** — the updater copies upstream files verbatim and would bring
them back. Full write-up: `migration-guides/2.19.0-vendor-config-public-unknown.md`.

**Independently of all that, prefer an `unknown` parameter at a `config.public.*`
boundary over `as string` at the call site.** That advice was always right for a second,
unrelated reason: Nitro applies `NUXT_PUBLIC_*` through `destr()`, so `NUXT_PUBLIC_X=42`
really does arrive as a number — in **both** modes. `app/utils/app-origin.ts` and
`server/utils/build-commit.ts` model the pattern.

## Tech Stack

- **Framework:** Nuxt 4.x with TypeScript 6.0.x
- **UI:** NuxtUI 4.x + TailwindCSS 4.x
- **Auth:** Better Auth (email/password, 2FA/TOTP, passkeys/WebAuthn)
- **Forms:** Valibot validation
- **API:** @hey-api/client-fetch with generated types (`types.gen.ts`, `sdk.gen.ts`)
- **State:** Pinia + VueUse + `useState()` for SSR-safe state
- **Testing:** Playwright E2E + Vitest

## Structure

```
app/                  # Application code (srcDir)
├── api-client/       # Generated types & SDK (types.gen.ts, sdk.gen.ts)
├── components/       # Auto-imported Vue components
├── composables/      # Auto-imported composables (use*.ts)
├── interfaces/       # Frontend-only TypeScript interfaces
├── layouts/          # Layout components
├── lib/              # Utility libraries (auth-client setup)
├── pages/            # File-based routing
└── utils/            # Auto-imported utilities
server/
├── api/              # Nitro server routes
├── plugins/          # Nitro runtime plugins (response headers, hooks)
└── utils/            # Auto-imported server-side utilities
tests/                # Playwright E2E + Vitest unit tests
nuxt.config.ts        # Nuxt configuration
```

Generated directories (all gitignored, all removed by `pnpm run clean`):

```
.nuxt/         # Build dir for `nuxt dev` and the IDE — refresh with `pnpm run prepare:ide`
.nuxt-check/   # Isolated build dir for the check chain (NUXT_BUILD_DIR)
.nuxt-test/    # Build dir for the `lt dev test` stack — written by the lt CLI, not by this repo
.output/       # Nitro output of `pnpm run build`
.output-test/  # Nitro output for `lt dev test` — written by the lt CLI (NITRO_OUTPUT_DIR)
```

Why `check` gets its own build dir: `nuxt dev`, `nuxt prepare` and `nuxt build` all
write their generated `tsconfig.json` into the build dir. With one shared `.nuxt/`, a
parked dev server rewrites that file while the check chain's type-check reads it, and
the run fails with TS2307 on every `~`/`#` alias — on code that is fine. The split
lets `check` and `dev` run in parallel. `tests/unit/nuxt-builddir-isolation.test.ts`
keeps the wiring honest.

`.nuxt-test/` and `.output-test/` are written by the **lt CLI** (a different repo),
never by anything here — a grep inside this template finds only ignore/clean entries,
which reads like dead configuration. It is not: deleting it breaks `lt dev test`.

## Development

```bash
pnpm dev              # Start dev server (port 3001)
pnpm run generate-types  # Generate API types (API must be running — see below)
pnpm test             # Run Playwright E2E tests
pnpm run build        # Build for production
pnpm run check        # Full quality check (audit + format + lint + types + test + build)
pnpm run typecheck    # Types of the APP sources (app/ + server/) — nuxt typecheck / vue-tsc
pnpm run typecheck:tests  # Types of the TEST suites (tests/) — tsc
pnpm run prepare:ide  # Refresh the IDE's .nuxt/ types
pnpm run clean        # Remove every generated build/output dir
```

### `generate-types` never guesses an API URL (DEV-2802)

`pnpm run generate-types` runs through [`scripts/generate-types.mjs`](scripts/generate-types.mjs),
which resolves the API URL before `openapi-ts` is started:

1. an explicit `NUXT_API_URL` wins (CI, Docker, an active `lt dev up` shell),
2. otherwise `<repo-root>/.lt-dev/.env` is loaded — the same bridge `lt dev init`
   injects into `playwright.config.ts` — so the documented call works under
   `lt dev up` **without** extra env,
3. otherwise the run **fails** with an actionable message. There is deliberately
   no default.

It additionally **refuses** a URL that belongs to a _different_ `lt dev` project
(`api.<other-slug>.localhost`) and warns when a registered project is generated
from some other host.

**Why the wrapper is a wrapper.** Under `lt dev up` the API is served over HTTPS
by Caddy's local CA, which Node only trusts via `NODE_EXTRA_CA_CERTS` — read at
process **startup**. Setting it from inside `openapi-ts.config.ts` is too late
(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`), so the values from `.lt-dev/.env` are
handed to a child process. `openapi-ts.config.ts` keeps a hard guard for direct
`openapi-ts` calls.

The old config fell back to a fixed `127.0.0.1:3000`. On a machine running
several lt projects in parallel that port belongs to _whichever_ project holds
it — the generator wrote `types.gen.ts` / `sdk.gen.ts` from a foreign contract,
printed a green checkmark and exited 0 (observed in lt-crm: `vuk-tools` answered
on :3000). Pinned by
[`tests/unit/generate-types-api-url.test.ts`](tests/unit/generate-types-api-url.test.ts).

### Two traps when raising Nuxt past 4.4.8 (measured in lt-crm, DEV-2802)

The August 2026 advisory wave forces `nuxt >= 4.5.1`. Two things cost real
debugging time there; both are reproducible, so do not re-derive them:

- **Take 4.5.1, not 4.5.2.** Under 4.5.2 `nuxt prepare` dies with a Node
  ESM/CJS interop assert (`loadCJSModuleWithModuleLoad`) while loading
  `@nuxtjs/i18n`'s `dist/module.mjs` — with 10.4.1 **and** with 10.6.0.
  Isolated by keeping the dependency overrides and rolling only Nuxt back,
  which goes green, so the trigger is Nuxt itself.
- **The bump breaks the type gate, and the cause is not in your code.**
  `@nuxt/test-utils/module` is registered in `modules`, so its types are part
  of the APP typecheck program — and from 4.5.1 on, happy-dom's DOM types
  shadow the real ones. A `ref<HTMLElement | null>` then stops satisfying
  `ResizeObserver.observe(target: Element)`. Do not cast at the call site; lift
  `@nuxt/test-utils` to 4.1.0 and `happy-dom` to 20.11.2, which restores it.

### Why the type gate has two halves

`nuxt build` only **transpiles** — it never resolves a type identifier. An import
pointing at a type that does not exist therefore survives lint, build, tests and
CI alike. That is not hypothetical: a consumer project accumulated 48 such errors
unseen before anything looked (lt-crm DEV-2726).

- **`typecheck`** covers `app/` + `server/` and runs on `vue-tsc` — plain `tsc`
  cannot resolve the `.vue` SFCs this half is made of.
- **`typecheck:tests`** covers `tests/` and runs on plain `tsc`, because the specs
  here import only `.ts`.

Both are wired into `check:raw` / `check:fix` / `check:naf` **and** into the CI
`typecheck` job. That second half is the one that matters: a gate reachable only
through `pnpm run check` never runs in a merge request, because no CI job calls
`check`. Both pin `NUXT_BUILD_DIR=.nuxt-check` so they cannot collide with a
parked `nuxt dev`; `tests/unit/nuxt-builddir-isolation.test.ts` enforces that.

### `config.public.*` types as `unknown` (vendor mode, before the fix)

The cause is **not** a missing schema block, as this file claimed until 2026-08-22:
`.nuxt/types/runtime-config.d.ts` is generated byte-identically in both modes,
`siteUrl: string` included — measured by converting the template and `diff`-ing the two
builds. The real fault is a cycle.

`app/core/runtime/types/module.ts` augments `PublicRuntimeConfig` under **both**
`nuxt/schema` and `@nuxt/schema`. The former re-exports the latter, so that is one
interface decorated twice — harmless while the file sits in `node_modules` and never
enters the program, fatal once vendoring makes it project source that `include` picks up
unconditionally. It then closes a loop with Nuxt's own generated
`interface PublicRuntimeConfig extends UserPublicRuntimeConfig`, and TypeScript reports
`TS2310: Type 'PublicRuntimeConfig' recursively references itself as a base type`. Every
member of an interface in that state resolves to `unknown`.

**Why it stayed unexplained:** Nuxt sets `skipLibCheck: true`, which suppresses TS2310
because it is reported in a `.d.ts`. Only the consequence surfaces — a plain
`Argument of type 'unknown' is not assignable to parameter of type 'string'` at a call
site that is not wrong. To see the cause:

```bash
npx vue-tsc --noEmit -p .nuxt-check/tsconfig.json --skipLibCheck false | grep TS2310
```

The `grep` is not optional: without it the run prints ~500 unrelated third-party `.d.ts`
errors even on a healthy project. Use the build dir the failing gate used
(`.nuxt-check` for `typecheck`, `.nuxt` for the IDE) — see the note below about `.nuxt/`
going stale. Two `ViteOptions` TS2310s appear even when everything is fine; the one that
matters names `PublicRuntimeConfig`.

**After running `check`, your IDE may show false errors** — run `pnpm run prepare:ide`.
The gates build into `.nuxt-check/` so they can run next to a live `nuxt dev`, which
means they no longer refresh the `.nuxt/` the editor reads. Before the build-dir split
that refresh happened as a side effect; `prepare:ide` is its named replacement.
(`pnpm run init` / `reinit` also resupply it, via `postinstall`.)

## Local Development (Parallel Projects)

This template ships with env-aware URL configuration. To run multiple lt-projects on the same machine without colliding on `localhost:3000`/`localhost:3001` and without cross-wiring auth cookies:

```bash
lt dev init                    # once per project: idempotent ENV patches
                               # auto-runs `lt dev install` first if the machine
                               # isn't set up yet (one hop, no recursion)
lt dev install                 # one-time per machine: Caddy + local CA
                               # (inside a project it auto-runs init afterwards)
lt dev up                      # start App + API behind Caddy under https://<slug>.localhost
lt dev down                    # stop the detached processes + remove Caddy block
lt dev status                  # show running PIDs + active URLs
lt dev status --all            # list all registered projects
lt dev doctor                  # diagnose Caddy / CA / DNS / port issues
```

First run in a fresh project: just `lt dev init` then `lt dev up`. (`lt dev migrate` still works as an alias for `init`.)

`lt dev up` exports the env vars the template respects:

- `PORT` — internal Nuxt dev server port (auto-allocated 4000+, never 3001)
- `NUXT_API_URL` — SSR API URL and the Vite dev proxy target (when active) — `https://api.<slug>.localhost`. Also the variable `generate-types` reads, but only from the **shell environment** — see the DEV-2802 section above.
- `NUXT_PUBLIC_API_URL` — client-side API URL — `https://api.<slug>.localhost`
- `NUXT_PUBLIC_SITE_URL` — the public origin of the app. Used by Playwright (`baseURL`, `webServer.url`) — `https://<slug>.localhost` — **and, in production, by two runtime consumers**: the SEO site config (canonical/OG/sitemap) and `runtimeConfig.public.siteUrl`, which builds the absolute auth redirect URLs that go into password-reset and verification mails. Never `NUXT_SITE_URL`: that reaches the SEO config but not `runtimeConfig.public.siteUrl`. See the `appUrl` section below.
- `NUXT_PUBLIC_STORAGE_PREFIX` — LocalStorage namespace (prevents key collisions across parallel projects) — `<slug>`
- `NUXT_PUBLIC_API_PROXY` — always `false` under `lt dev up` because Caddy + cookie-domain make the vite-proxy obsolete

Without `lt dev up`, the template falls back to the defaults (port 3001, API on `localhost:3000`, `NUXT_PUBLIC_API_PROXY=true` for same-origin cookies in classic mode). All env vars are optional — **except for `generate-types`**, which has no default at all and fails rather than guess a port (DEV-2802, section above).

**Two more env vars the template respects, set per command rather than by `lt dev up`:**

- `NUXT_BUILD_DIR` — Nuxt build dir; default `.nuxt`. The check chain pins `.nuxt-check`, `lt dev test` pins `.nuxt-test`. Keeps a gate run from corrupting the `.nuxt/` a parked `nuxt dev` is reading.
- `NITRO_OUTPUT_DIR` — Nitro output dir; default `.output`. `lt dev test` pins `.output-test`. **Not a Nitro feature** — despite the `NITRO_` prefix, nitropack ships no such lever; `nuxt.config.ts` opens it. A project that does not forward it silently falls back to the shared `.output`.

Both are read in `nuxt.config.ts` with `||`, not `??`: an exported-but-empty value is falsy but not nullish, and an empty build dir resolves to the project root — which would write generated files over the checked-in sources.

Scripts that set env vars use `cross-env` rather than a bare `VAR=value` prefix, which is POSIX-only and fails in `cmd.exe`. The check runner (`scripts/check.mjs`) instead passes an env object to `spawn`, because it runs commands directly and `node_modules/.bin` is not on the inherited PATH.

**E2E tests run in all three environments** (classic ports / `lt dev up` / CI) from the same specs. Test code reads `NUXT_PUBLIC_API_URL` / `NUXT_PUBLIC_SITE_URL` / `API_URL` with `localhost:3000` / `:3001` fallbacks — never hardcode ports in `tests/e2e/*`. When injecting captured auth cookies into the browser, preserve the `Secure` flag (HTTPS under `lt dev`) and derive the cookie domain from the app host.

**Setting these manually** (e.g. in CI):

```bash
PORT=4011 NUXT_PUBLIC_SITE_URL=https://crm.localhost NUXT_PUBLIC_API_URL=https://api.crm.localhost pnpm dev
```

## Standards

| Rule             | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| UI Labels        | German (`Speichern`, `Abbrechen`)                                  |
| Code/Comments    | English                                                            |
| Styling          | TailwindCSS only, no `<style>` blocks                              |
| Colors           | Semantic only (`primary`, `error`, `success`)                      |
| Types            | Explicit, no implicit `any`                                        |
| Backend Types    | Generated only (`types.gen.ts`) — never manual interfaces for DTOs |
| Forms            | Valibot (not Zod)                                                  |
| Modals           | `useOverlay()` (programmatic)                                      |
| Auth             | `useBetterAuth()` from `@lenne.tech/nuxt-extensions`               |
| Protected Routes | `middleware: 'auth'` in page `definePageMeta`                      |

## AI Module (since v2.8.0)

The starter ships a full AI assistant UI on top of `@lenne.tech/nuxt-extensions` 1.7.x
composables (which talk to the `@lenne.tech/nest-server` 11.26.0+ AI module).

**Composables consumed** (auto-imported when `ltExtensions.ai.enabled: true` in `nuxt.config.ts`):

| Composable              | Used by                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `useLtAiChat()`         | `app/components/Ai/AiChat.vue` — streaming + budget + ctx                                                  |
| `useLtAiPrompts()`      | `app/components/Ai/AiPromptPicker.vue`, `pages/app/settings/ai-prompts.vue`                                |
| `useLtAiPlaceholders()` | `app/components/Ai/AiPlaceholderHint.vue`                                                                  |
| `useLtAiConnections()`  | `app/components/Ai/AiConnectionPicker.vue`, `pages/app/settings/ai.vue`                                    |
| `useLtAiUsage()`        | `pages/app/settings/ai.vue`                                                                                |
| `useLtAiAdmin()`        | `pages/app/admin/ai/*.vue` (CRUD for connections, budgets, slots, prompt-hints, preferences, interactions) |

**Config block** (`nuxt.config.ts`):

```ts
ltExtensions: {
  ai: {
    enabled: true,         // Set false to disable the AI module entirely.
    basePath: '/ai',       // Must match the nest-server AI controller mount point.
  },
  // ...
}
```

**Performance notes:**

- `AiChat.vue` passes `maxMessages: 100` to `useLtAiChat()` to cap history growth.
- The auto-scroll watcher source is `[messages.value.length, messages.value.at(-1)?.content]` (O(1) per SSE token); never re-introduce a `messages.map(...).join(...)` source.

## Admin Gating — `isAdminUser`

The project's admin role check has to accept **two shapes** because backend providers
differ:

- **`role: string`** — Better Auth singular form (default for the standalone Better Auth setup).
- **`roles: string[]`** — nest-server projection (`AuthService` flattens user roles to an array).

The canonical helper lives in `app/utils/is-admin-user.ts` (auto-imported as `isAdminUser`).
It is used by every site that gates admin functionality:

- `app/middleware/admin.global.ts` — route guard for `/app/admin/**`
- `app/layouts/default.vue` — admin nav entry
- `app/pages/app/settings/ai-prompts.vue` — mutate-foreign-prompt gate

**Rule:** never re-implement the dual-shape check inline. Always import / call
`isAdminUser(user)`. The Vitest spec at `tests/unit/utils/is-admin-user.test.ts`
guards the contract (no user / `role:'admin'` / `roles:['admin']` / both / neither).

## Framework: @lenne.tech/nuxt-extensions

This project consumes the framework in one of two modes:

- **npm mode (default):** `@lenne.tech/nuxt-extensions` is installed as
  an npm dependency; framework source lives in
  `node_modules/@lenne.tech/nuxt-extensions/`. Registered in
  `nuxt.config.ts` via the module string `'@lenne.tech/nuxt-extensions'`.
- **vendor mode:** framework source is copied directly into
  `app/core/` as first-class project code. No
  `@lenne.tech/nuxt-extensions` npm dependency. Baseline + patch log
  live in `app/core/VENDOR.md`. Updated via
  `/lt-dev:frontend:update-nuxt-extensions-core`. Detect via:
  `test -f app/core/VENDOR.md`.

**ALWAYS read the actual framework source** before guessing behavior —
in npm mode from `node_modules/@lenne.tech/nuxt-extensions/`, in
vendor mode directly from `app/core/`.

### Vendor Modification Policy

When this project is in vendor mode, the copy in `app/core/` exists
so Claude Code can read framework internals directly — it is a
**comprehension aid**, not a fork. Only edit `app/core/` when the
change is **generally useful to every nuxt-extensions consumer**:

- Bugfixes that apply to every consumer
- Broad framework enhancements (new composables, better defaults,
  SSR fixes)
- Security vulnerability fixes
- Type/config compatibility fixes every consumer would hit

**Everything else stays out of `app/core/`.** Project-specific
business rules, customer branding, and proprietary integrations
belong in project code (`app/composables/`, `app/components/`,
`app/middleware/`, plugin overrides).

**Generally-useful changes MUST be submitted as an upstream PR** to
`github.com/lenneTech/nuxt-extensions`. Run
`/lt-dev:frontend:contribute-nuxt-extensions-core` to prepare the PR
— the agent filters cosmetic commits, categorizes each local change
as upstream-candidate vs. project-specific, and writes PR drafts for
human review. Letting useful fixes rot in a single project's vendor
tree is an anti-pattern: they belong upstream so every consumer
benefits and the local patch disappears on the next sync.

### Key Source Files (in node_modules/@lenne.tech/nuxt-extensions/ — npm mode; replace prefix with app/core/ in vendor mode)

| File                        | Purpose                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `CLAUDE.md`                 | Framework overview, composables, components, configuration |
| `dist/runtime/composables/` | Available composables (useBetterAuth, useTusUpload, etc.)  |
| `dist/runtime/components/`  | Available auto-imported components                         |
| `dist/runtime/middleware/`  | Route middleware (auth)                                    |
| `dist/runtime/plugins/`     | Nuxt plugins (auth initialization)                         |
| `dist/runtime/server/`      | Nitro server routes (auth proxy)                           |
| `dist/runtime/utils/`       | Available utility functions                                |
| `dist/runtime/types/`       | TypeScript type definitions                                |

### Rules

1. **ALWAYS read actual source code** before guessing framework behavior — from `node_modules/@lenne.tech/nuxt-extensions/` in npm mode, or from `app/core/` in vendor mode
2. **NEVER re-implement** functionality that nuxt-extensions already provides — check composables first
3. **Use `useBetterAuth()`** for authentication — never implement auth manually
4. **When debugging auth issues**, read the auth proxy server route and middleware source
5. **Check runtime composables** before creating new composables — may already exist
6. **In vendor mode**, only edit `app/core/` for generally-useful changes and submit them upstream via `/lt-dev:frontend:contribute-nuxt-extensions-core`. Project-specific code belongs outside `app/core/`.

## Authentication

Auth is managed by `@lenne.tech/nuxt-extensions` via `useLtAuth()`. See the [nuxt-extensions CLAUDE.md](https://github.com/lenneTech/nuxt-extensions) for detailed auth cookie rules.

Key rule: Never manually write to the auth-state cookie from custom middleware. Use `useLtAuth().setUser()` / `clearUser()` exclusively.

### Configurable cookie names (optional)

The auth cookies default to `lt-auth-state` and `lt-jwt-token`. Projects that need to coexist with another lenne.tech app on the same domain can override them in `nuxt.config.ts`:

```ts
ltExtensions: {
  auth: {
    cookieNames: {
      state: 'my-app-auth-state',
      token: 'my-app-jwt',
    },
  },
}
```

Each key is independent — set only the one you need. The starter's global middleware (`app/middleware/auth.global.ts`, `guest.global.ts`, `admin.global.ts`) reads the resolved cookie name from `useRuntimeConfig().public.ltExtensions.auth.cookieNames.state` and falls back to the default.

### Redirect-aware auth flows — `safeRedirectTarget`

`auth.global` sends an unauthenticated visitor to `/auth/login?redirect=<to.fullPath>`
so a shared deep link survives the sign-in. Four places read that value back:
`guest.global` (already signed in), `login.vue`, `2fa.vue`, and `verify-email.vue`
(which carries it onward rather than consuming it).

**Rule:** never read `route.query.redirect` directly. Always go through
`safeRedirectTarget()` (`app/utils/safe-redirect-target.ts`, auto-imported), exactly
as with `isAdminUser`. It rejects protocol-relative targets (`//evil.com`), the
backslash variant, control characters — a tab or newline is stripped by the URL
parser, turning `/<TAB>/evil.com` into `//evil.com` — and non-string query shapes
(`?redirect=/a&redirect=/b` yields an array). Anything invalid falls back to `/app`.

Relying on `navigateTo`'s own external-URL refusal is not enough: it throws, and on
the login page that throw lands in a catch which tells a user who has just been
signed in successfully that login failed. Validate where the value is read.

**When adding an intermediate auth step**, carry the query through it, or the deep
link dies there. `tests/unit/utils/safe-redirect-target.test.ts` pins the validator's
behaviour.

### Absolute auth redirect URLs — `appUrl`

Better Auth resolves a `redirectTo` / `callbackURL` **against its own base URL**, which
is the API origin (`password.mjs`: `new URL(callbackURL, ctx.baseURL)`). In this stack
app and API are separate hosts, so a relative path lands on `api.<host>` where the route
does not exist. Every auth redirect therefore has to be an absolute **app** URL.

**Rule:** never interpolate the config value (`` `${config.public.siteUrl}/auth/x` ``).
When `siteUrl` is unset that produces the literal text `"undefined/auth/x"`, Better Auth
answers 403 INVALID_REDIRECT_URL, and no mail is ever sent — that is exactly how a
production password reset broke. Always go through `appUrl()`
(`app/utils/app-origin.ts`, auto-imported), as with `isAdminUser` and
`safeRedirectTarget`:

```ts
redirectTo: appUrl('/auth/reset-password', config.public.siteUrl),
```

Two contracts worth knowing before reusing it:

- **Client-side only unless configured.** `resolveAppOrigin` returns `''` on the server
  (there is no window to fall back to), and `appUrl` **throws** rather than returning a
  relative URL — a relative value would be accepted by Better Auth and then resolved
  against the API origin, reproducing the same silent wrongness. Call it from a client
  handler, or make sure `NUXT_PUBLIC_SITE_URL` is set.
- **Only the origin of `configured` survives.** A path, query or credentials in the env
  value are discarded (`new URL(...).origin`), and plain `http:` is accepted only for
  loopback hosts. `path` must be a single-slash absolute path, same contract as
  `safeRedirectTarget`.

Current call sites: `pages/auth/forgot-password.vue` and `pages/auth/verify-email.vue`.
`tests/unit/utils/app-origin.test.ts` pins the resolver;
`tests/unit/runtime-config-contract.test.ts` pins that every documented
`NUXT_PUBLIC_*` variable actually has a `runtimeConfig.public` key to land in — the
guard that was missing when the lockout happened.

**The backend has to cooperate, twice.** Before debugging a reset that still does not
work, check both:

- **`@lenne.tech/nest-server` >= 11.36.1.** Older versions wire no
  `emailAndPassword.sendResetPassword` hook, so `POST /iam/request-password-reset`
  answers `RESET_PASSWORD_DISABLED` and sends nothing — no matter what this side supplies.
  The origin check runs first, so before the 2.18.0 fix that failure was invisible behind
  the 403. Symptom afterwards: no error in the browser, no mail either.
- **The app origin is in the backend's `trustedOrigins`, exactly, without a wildcard.**
  `redirectTo` is validated against that list, and the reset redirect carries a live
  one-time token — a wildcard hands it to any origin it admits. nest-server warns at boot
  from 11.36.1.

## Security Overrides (pnpm)

All workspace-scoped pnpm settings — `overrides` (CVE patches for vulnerable transitive deps), `minimumReleaseAgeExclude`, build-script approvals (`allowBuilds` / `onlyBuiltDependencies`), and `ignoredOptionalDependencies` — live in **`pnpm-workspace.yaml`**, each with an inline comment stating its reason (CVE/advisory). The detailed advisory list is therefore the file itself, not duplicated here.

Rules that matter when touching them:

- **Location:** these keys MUST be in `pnpm-workspace.yaml`, never in `package.json`'s `pnpm` block — pnpm 11 silently ignores the latter, regressing `pnpm audit` to several vulnerabilities. The file has NO `packages:` field (single-package project). Override targets are fixed versions (no ranges) to avoid silent major-version jumps.
- **Only override what this project resolves:** a dead override (package not in the lockfile) is useless and, inside an `lt fullstack` monorepo, a range selector can shadow the api's override and re-introduce a CVE. Backend-only packages (e.g. `hono`) are owned by nest-server. Check with `grep "'\?<pkg>@[0-9]" pnpm-lock.yaml`.
- **Suppression is the last resort, and "unfixable" needs proof.** `auditConfig.ignoreGhsas` silences one advisory by GHSA id — the only tool here that makes `pnpm audit` green while the vulnerability is still present. Before reaching for it, work the ladder: (1) can an `overrides` entry raise it? (2) if the patched release changed its export shape, can a `patchedDependencies` entry adapt the ONE consumer that breaks? (3) only then suppress. Step 2 is the one that gets skipped: the root `pnpm-workspace.yaml` carried a suppressed high-severity brace-expansion advisory whose justification was mechanically correct — `minimatch@3` calls `require('brace-expansion')` as a function, and the only patched release exports a namespace object — but the conclusion was wrong. A one-line patch reading `.expand` off the namespace closed it. Every suppression MUST name the advisory, trace the path, state why steps 1 and 2 both fail, state why the residual risk is acceptable (who runs the code, over what input, whether it reaches a generated project's runtime), give the condition for deleting it, and carry a `Verified <date>`. One id per entry — never a range or a whole package.
- **A patch is legitimate when the break is a shape change, not a behaviour change.** `patchedDependencies` is the right tool when a patched release is functionally identical but structurally incompatible with one consumer. Verify the equivalence before patching (run the old and new function against the same inputs and compare), keep the patch to the adapter line, and record the verification in the comment. Note that patch files must reach the Docker build context — the `Dockerfile` copies `patches/` for exactly this reason.
- **A cross-major override needs its export shape checked.** Lifting a package across a major can change its CJS shape from a callable to a namespace object, which breaks `require('pkg')(…)` at runtime rather than at install time. Measure it (`typeof require('<pkg>')` on each version in the range), name the consumers, and record the result in the comment — see the `minimatch` entry for the worked example.
- **`minimumReleaseAge`** (pnpm 11 default: 1 day) quarantines freshly published versions against supply-chain attacks. Our own packages are exempt via the `@lenne.tech/*` glob (installable the moment they publish); third-party exemptions are exact `pkg@version`, deliberate and temporary. Never disable the policy globally (`minimumReleaseAge: 0` / `trustLockfile: true`). After bumping `@lenne.tech/*`, run a full `pnpm install` (not just `pnpm run check`) so pnpm's state cache picks up the exclude.

## Notable Version Changes (v2.5.x)

- **TypeScript 5.9 -> 6.0:** Changes `erasableSyntaxOnly` default and tightens module resolution. Run `pnpm run build` to verify no type regressions after upgrading existing projects.
- **@nuxtjs/seo 3.4 -> 5.1:** Major rewrite (v4 was skipped). The OG image engine switched to `@shikijs/*` for syntax highlighting (SSR/build-time only). `nuxt.config.ts` SEO options are backwards-compatible. The 30 `ignoredOptionalDependencies` entries are required for clean installs.