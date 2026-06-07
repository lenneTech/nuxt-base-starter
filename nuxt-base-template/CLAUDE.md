# nuxt-base-starter

## Project Overview

Starter template for Nuxt 4 applications using the lenne.tech stack. Used by `lt fullstack init` to scaffold new frontend projects.

## Framework Mode (npm vs. vendor) — read first

This project consumes `@lenne.tech/nuxt-extensions` in one of two modes. Detect it:

- **vendor mode** if `app/core/VENDOR.md` exists → the module is vendored into
  `app/core/` as first-class project code (no npm dependency). Read framework code from
  `app/core/`, not `node_modules/`.
- **npm mode** otherwise → the framework is the `@lenne.tech/nuxt-extensions` dependency.

| Action | vendor mode | npm mode |
|---|---|---|
| Update framework | `/lt-dev:frontend:update-nuxt-extensions-core` (also raises npm packages to at least the upstream baseline via `/lt-dev:maintenance:maintain`) | `pnpm update @lenne.tech/nuxt-extensions` |
| Contribute a generally-useful core fix upstream | `/lt-dev:frontend:contribute-nuxt-extensions-core` | open a PR on `@lenne.tech/nuxt-extensions` |

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

The `overrides` in `pnpm-workspace.yaml` force vulnerable transitive dependencies to patched versions. Each override addresses a specific CVE or security advisory:

These settings live in `pnpm-workspace.yaml` (NOT in `package.json`'s `pnpm` block). pnpm 11 silently ignores `overrides`, `ignoredOptionalDependencies`, and build-script settings when they are declared in `package.json` — it prints a warning and drops them, which would regress `pnpm audit` to several vulnerabilities. `pnpm-workspace.yaml` is the pnpm-recommended home for these keys and is read by pnpm 10 AND pnpm 11. The file intentionally has NO `packages:` field (single-package project).

All override targets use fixed versions (not ranges) to prevent silent major-version jumps. See TurboOps incident (April 2026) in the agent memory for context.

| Override                         | Advisory                                                                                                                                                                                                                              | Notes                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@hono/node-server@<1.19.14`     | GHSA-7256-2wf4-hf2r, GHSA-92pp-h63x-v22m                                                                                                                                                                                              | Request smuggling + middleware bypass via repeated slashes                                                                                                                              |
| `brace-expansion@>=2.0.0 <2.0.3` | GHSA-f886-m6hf-6m8v                                                                                                                                                                                                                   | ReDoS via zero-step sequences                                                                                                                                                           |
| `brace-expansion@>=4.0.0 <5.0.6` | GHSA-f886-m6hf-6m8v, GHSA-jxxr-4gwj-5jf2                                                                                                                                                                                              | ReDoS via zero-step sequences (5.x range) + ReDoS in 5.0.x patched in 5.0.6                                                                                                             |
| `drizzle-orm@<0.45.2`            | GHSA-gpj5-g38j-94v9                                                                                                                                                                                                                   | SQL injection via improperly escaped identifiers; transitive via @nuxtjs/seo>nuxt-link-checker>unstorage>db0                                                                            |
| `readdir-glob@<2.0.3`            | (transitive)                                                                                                                                                                                                                          | Forces minimatch upgrade for brace-expansion fix                                                                                                                                        |
| `defu@<=6.1.4`                   | GHSA-mchp-fgcf-hmfj                                                                                                                                                                                                                   | Prototype pollution                                                                                                                                                                     |
| `devalue@<5.8.1`                 | GHSA-77p6-w3v8-rqwf, GHSA-77vg-94rm-hx3p                                                                                                                                                                                              | XSS via crafted input + prototype pollution / DoS patched in 5.8.1                                                                                                                      |
| `effect@<3.20.0`                 | GHSA-j44v-mmf2-xvm9                                                                                                                                                                                                                   | Denial of service                                                                                                                                                                       |
| `fast-xml-builder@<1.1.7`        | GHSA-5wm8-gmm8-39j9, GHSA-45c6-75p6-83cc                                                                                                                                                                                              | Attribute quote bypass + Comment regex bypass; transitive via @nuxtjs/seo>sitemap>fast-xml-parser                                                                                       |
| `fast-xml-parser@<5.7.3`         | GHSA-gh4j-gqv2-49f6                                                                                                                                                                                                                   | XMLBuilder: XML comment and CDATA injection via unescaped delimiters; transitive via @nuxtjs/seo>sitemap                                                                                |
| `h3@<1.15.9`                     | GHSA-wr4h-v87w-p3r7                                                                                                                                                                                                                   | Path traversal                                                                                                                                                                          |
| `h3@>=2.0.0-0 <2.0.1-rc.18`      | GHSA-q5pr-72pq-83v3                                                                                                                                                                                                                   | Cookie DoS + SSE injection                                                                                                                                                              |
| `h3-next`                        | (alias fix)                                                                                                                                                                                                                           | `@nuxt/test-utils` pins h3-next to vulnerable RC; remove when h3 v2 stable releases                                                                                                     |
| `hono@<4.12.18`                  | GHSA-rp6g-89hg-4gfv, GHSA-26pp-8wgv-hjvm, GHSA-r5rp-j6wh-rvv4, GHSA-wmmm-f939-6g9c, GHSA-xpcf-pg52-r92g, GHSA-458j-xx4x-4375, GHSA-9vqf-7f2p-gf9v, GHSA-69xw-7hcm-h432, GHSA-qp7p-654g-cw7p, GHSA-p77w-8qqv-26rm, GHSA-hm8q-7f3q-5f36 | SSRF, cookie validation, IP bypass, JSX injection, bodyLimit bypass, CSS injection in JSX SSR, cache leakage, JWT NumericDate validation; transitive via better-auth>prisma>@prisma/dev |
| `js-cookie@<3.0.7`               | GHSA-qjx8-664m-686j                                                                                                                                                                                                                   | Insecure cookie handling; transitive via @vue/test-utils>js-beautify (dev/test only)                                                                                                    |
| `kysely@>=0.26.0 <0.28.17`       | GHSA-4hxq-5gxr-453h, GHSA-pv5w-4p9q-p3v2                                                                                                                                                                                              | SQL injection (≤0.28.13) + additional SQL injection patched in 0.28.17                                                                                                                  |
| `lodash@>=4.0.0 <=4.17.23`       | GHSA-x5rq-j2xg-h7qm                                                                                                                                                                                                                   | Prototype pollution                                                                                                                                                                     |
| `minimatch@>=9.0.0 <9.0.7`       | GHSA-f886-m6hf-6m8v                                                                                                                                                                                                                   | ReDoS via brace-expansion                                                                                                                                                               |
| `node-forge@<1.4.0`              | GHSA-997c-fj8j-rq5h                                                                                                                                                                                                                   | RSA signature forgery                                                                                                                                                                   |
| `nuxt-og-image@>=6.2.5 <6.4.9`   | GHSA-c2rm-g55x-8hr5                                                                                                                                                                                                                   | SSRF — bypass of GHSA-pqhr-mp3f-hrpp / v6.2.5 fix (IPv6 + redirect); transitive via @nuxtjs/seo                                                                                         |
| `picomatch@<2.3.2`               | GHSA-26j4-r882-m4jm                                                                                                                                                                                                                   | ReDoS                                                                                                                                                                                   |
| `picomatch@>=4.0.0 <4.0.4`       | GHSA-26j4-r882-m4jm                                                                                                                                                                                                                   | Same advisory, 4.x range                                                                                                                                                                |
| `postcss@<8.5.14`                | (defensive)                                                                                                                                                                                                                           | Force latest postcss patch across all consumers; covers historical advisories                                                                                                           |
| `rollup@>=4.0.0 <4.60.3`         | GHSA-gcx4-mw62-g3rm                                                                                                                                                                                                                   | DOM clobbering in output                                                                                                                                                                |
| `serialize-javascript@<=7.0.4`   | GHSA-cqmj-v5x6-4hg7                                                                                                                                                                                                                   | XSS via crafted object                                                                                                                                                                  |
| `simple-git@<3.36.0`             | GHSA-hffm-xvc3-vprc                                                                                                                                                                                                                   | Remote Code Execution; transitive via @nuxt/devtools                                                                                                                                    |
| `srvx@<0.11.13`                  | GHSA-4r4v-8rg6-5crc                                                                                                                                                                                                                   | Open redirect                                                                                                                                                                           |
| `tar@<=7.5.10`                   | GHSA-jg7w-cxjv-98c2                                                                                                                                                                                                                   | Path traversal                                                                                                                                                                          |
| `unhead@<=2.1.12`                | GHSA-gxhp-jfhg-5fv8, GHSA-95h2-gj7x-gx9w                                                                                                                                                                                              | XSS via meta tags + hasDangerousProtocol() bypass via leading-zero padded HTML entities                                                                                                 |
| `vite@>=7.0.0 <7.3.2`            | GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583, GHSA-4w7w-66w2-5vf9                                                                                                                                                                         | fs.deny bypass, arbitrary file read via WebSocket, path traversal in .map                                                                                                               |
| `ws@>=8.0.0 <8.20.1`             | GHSA-58qx-3vcg-4xpx                                                                                                                                                                                                                   | DoS via memory exhaustion on crafted frames; transitive via vitest>happy-dom (dev/test only)                                                                                            |
| `yaml@>=2.0.0 <2.8.3`            | GHSA-4hm9-844j-jmxp                                                                                                                                                                                                                   | Code execution via crafted YAML                                                                                                                                                         |

The `ignoredOptionalDependencies` block in `pnpm-workspace.yaml` suppresses 30 platform-specific native binaries (`@img/sharp-*`, `@resvg/resvg-js-*`) that are pulled in by `@nuxtjs/seo` 5.x's OG image engine. Only the host-platform binary is needed at build time.

Build-script approval for native deps (`sharp`, `esbuild`, `@parcel/watcher`, `simple-git-hooks`, `vue-demi`) is declared twice in `pnpm-workspace.yaml` for cross-version compatibility: `allowBuilds` (pnpm 11 key) and `onlyBuiltDependencies` (pnpm 10 key). Each pnpm version reads its own key and ignores the other.

### `minimumReleaseAgeExclude` (pnpm 11 supply-chain policy)

`pnpm-workspace.yaml` carries a `minimumReleaseAgeExclude` block listing exact `pkg@version` entries that are allowed to bypass the global minimum-release-age supply-chain guard (the guard rejects packages released within the last few days unless explicitly excluded). pnpm 11 auto-appends entries the first time a fresh dependency is installed, so the block grows whenever the project pulls in a same-day Better Auth / nuxt-extensions / nest-server release.

**Maintenance rules:**

- Each entry is intentional — it covers exactly one fresh version of one package. Do NOT loosen to a version range.
- When bumping a covered dep, also remove the now-stale entry (e.g. after `1.7.1` ages out, drop the `1.7.1` line on the next bump).
- Removing an entry without first removing the dependency or waiting for the age threshold will block `pnpm install` for everyone with the same lockfile until the age threshold is met.
- Never disable the policy globally — it is the project's first line of defense against supply-chain attacks via freshly published malicious versions.

## Notable Version Changes (v2.5.x)

- **TypeScript 5.9 -> 6.0:** Changes `erasableSyntaxOnly` default and tightens module resolution. Run `pnpm run build` to verify no type regressions after upgrading existing projects.
- **@nuxtjs/seo 3.4 -> 5.1:** Major rewrite (v4 was skipped). The OG image engine switched to `@shikijs/*` for syntax highlighting (SSR/build-time only). `nuxt.config.ts` SEO options are backwards-compatible. The 30 `ignoredOptionalDependencies` entries are required for clean installs.