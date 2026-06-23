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
server/               # Nitro server routes
tests/                # Playwright E2E tests
nuxt.config.ts        # Nuxt configuration
```

## Development

```bash
pnpm dev              # Start dev server (port 3001)
pnpm run generate-types  # Generate API types (API must be running on port 3000 — or NUXT_API_URL)
pnpm test             # Run Playwright E2E tests
pnpm run build        # Build for production
pnpm run check        # Full quality check (audit + format + lint + types + test + build)
```

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
- `NUXT_API_URL` — used by `generate-types` and the Vite dev proxy (when active) — `https://api.<slug>.localhost`
- `NUXT_PUBLIC_API_URL` — client-side API URL — `https://api.<slug>.localhost`
- `NUXT_PUBLIC_SITE_URL` — used by Playwright (`baseURL`, `webServer.url`) — `https://<slug>.localhost`
- `NUXT_PUBLIC_STORAGE_PREFIX` — LocalStorage namespace (prevents key collisions across parallel projects) — `<slug>`
- `NUXT_PUBLIC_API_PROXY` — always `false` under `lt dev up` because Caddy + cookie-domain make the vite-proxy obsolete

Without `lt dev up`, the template falls back to the defaults (port 3001, API on `localhost:3000`, `NUXT_PUBLIC_API_PROXY=true` for same-origin cookies in classic mode). All env vars are optional.

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

## Security Overrides (pnpm)

All workspace-scoped pnpm settings — `overrides` (CVE patches for vulnerable transitive deps), `minimumReleaseAgeExclude`, build-script approvals (`allowBuilds` / `onlyBuiltDependencies`), and `ignoredOptionalDependencies` — live in **`pnpm-workspace.yaml`**, each with an inline comment stating its reason (CVE/advisory). The detailed advisory list is therefore the file itself, not duplicated here.

Rules that matter when touching them:

- **Location:** these keys MUST be in `pnpm-workspace.yaml`, never in `package.json`'s `pnpm` block — pnpm 11 silently ignores the latter, regressing `pnpm audit` to several vulnerabilities. The file has NO `packages:` field (single-package project). Override targets are fixed versions (no ranges) to avoid silent major-version jumps.
- **Only override what this project resolves:** a dead override (package not in the lockfile) is useless and, inside an `lt fullstack` monorepo, a range selector can shadow the api's override and re-introduce a CVE. Backend-only packages (e.g. `hono`) are owned by nest-server. Check with `grep "'\?<pkg>@[0-9]" pnpm-lock.yaml`.
- **`minimumReleaseAge`** (pnpm 11 default: 1 day) quarantines freshly published versions against supply-chain attacks. Our own packages are exempt via the `@lenne.tech/*` glob (installable the moment they publish); third-party exemptions are exact `pkg@version`, deliberate and temporary. Never disable the policy globally (`minimumReleaseAge: 0` / `trustLockfile: true`). After bumping `@lenne.tech/*`, run a full `pnpm install` (not just `pnpm run check`) so pnpm's state cache picks up the exclude.

## Notable Version Changes (v2.5.x)

- **TypeScript 5.9 -> 6.0:** Changes `erasableSyntaxOnly` default and tightens module resolution. Run `pnpm run build` to verify no type regressions after upgrading existing projects.
- **@nuxtjs/seo 3.4 -> 5.1:** Major rewrite (v4 was skipped). The OG image engine switched to `@shikijs/*` for syntax highlighting (SSR/build-time only). `nuxt.config.ts` SEO options are backwards-compatible. The 30 `ignoredOptionalDependencies` entries are required for clean installs.