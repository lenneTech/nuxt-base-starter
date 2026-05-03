# nuxt-base-starter

## Project Overview

Starter template for Nuxt 4 applications using the lenne.tech stack. Used by `lt fullstack init` to scaffold new frontend projects.

> **Note (`next` branch):** This branch is adapted for the new `lenneTech/nest-base` server. Better-Auth is consumed at `/api/auth/*` (not the legacy `/iam/*` mount), and the SDK generator reads from `/api/openapi.json` (the canonical OpenAPI document, not the deprecated `/api-docs-json` alias). The Nitro proxy under `server/api/auth/[...path].ts` forwards to `${apiUrl}/api/auth/*` accordingly. Consumed by `lt fullstack init --next`.

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
pnpm run generate-types  # Generate API types (API must be running on port 3000)
pnpm test             # Run Playwright E2E tests
pnpm run build        # Build for production
pnpm run check        # Full quality check (audit + format + lint + types + test + build)
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

Key rule: Never manually write to the `lt-auth-state` cookie from custom middleware. Use `useLtAuth().setUser()` / `clearUser()` exclusively.

## Security Overrides (pnpm)

The `pnpm.overrides` in `package.json` force vulnerable transitive dependencies to patched versions. Each override addresses a specific CVE or security advisory:

All override targets use fixed versions (not ranges) to prevent silent major-version jumps. See TurboOps incident (April 2026) in the agent memory for context.

| Override                         | Advisory                                                                                                                     | Notes                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@hono/node-server@<1.19.14`     | GHSA-7256-2wf4-hf2r, GHSA-92pp-h63x-v22m                                                                                     | Request smuggling + middleware bypass via repeated slashes                                                   |
| `brace-expansion@>=2.0.0 <2.0.3` | GHSA-f886-m6hf-6m8v                                                                                                          | ReDoS via zero-step sequences                                                                                |
| `brace-expansion@>=4.0.0 <5.0.5` | GHSA-f886-m6hf-6m8v                                                                                                          | Same advisory, 5.x range                                                                                     |
| `drizzle-orm@<0.45.2`            | GHSA-gpj5-g38j-94v9                                                                                                          | SQL injection via improperly escaped identifiers; transitive via @nuxtjs/seo>nuxt-link-checker>unstorage>db0 |
| `readdir-glob@<2.0.3`            | (transitive)                                                                                                                 | Forces minimatch upgrade for brace-expansion fix                                                             |
| `defu@<=6.1.4`                   | GHSA-mchp-fgcf-hmfj                                                                                                          | Prototype pollution                                                                                          |
| `devalue@<=5.6.3`                | GHSA-77p6-w3v8-rqwf                                                                                                          | XSS via crafted input                                                                                        |
| `effect@<3.20.0`                 | GHSA-j44v-mmf2-xvm9                                                                                                          | Denial of service                                                                                            |
| `fast-xml-parser@<5.7.0`         | GHSA-gh4j-gqv2-49f6                                                                                                          | XMLBuilder: XML comment and CDATA injection via unescaped delimiters; transitive via @nuxtjs/seo>sitemap     |
| `h3@<1.15.9`                     | GHSA-wr4h-v87w-p3r7                                                                                                          | Path traversal                                                                                               |
| `h3@>=2.0.0-0 <2.0.1-rc.18`      | GHSA-q5pr-72pq-83v3                                                                                                          | Cookie DoS + SSE injection                                                                                   |
| `h3-next`                        | (alias fix)                                                                                                                  | `@nuxt/test-utils` pins h3-next to vulnerable RC; remove when h3 v2 stable releases                          |
| `hono@<4.12.14`                  | GHSA-rp6g-89hg-4gfv, GHSA-26pp-8wgv-hjvm, GHSA-r5rp-j6wh-rvv4, GHSA-wmmm-f939-6g9c, GHSA-xpcf-pg52-r92g, GHSA-458j-xx4x-4375 | SSRF, cookie validation, IP bypass, JSX injection                                                            |
| `kysely@>=0.26.0 <=0.28.13`      | GHSA-4hxq-5gxr-453h                                                                                                          | SQL injection                                                                                                |
| `lodash@>=4.0.0 <=4.17.23`       | GHSA-x5rq-j2xg-h7qm                                                                                                          | Prototype pollution                                                                                          |
| `minimatch@>=9.0.0 <9.0.7`       | GHSA-f886-m6hf-6m8v                                                                                                          | ReDoS via brace-expansion                                                                                    |
| `node-forge@<1.4.0`              | GHSA-997c-fj8j-rq5h                                                                                                          | RSA signature forgery                                                                                        |
| `picomatch@<2.3.2`               | GHSA-26j4-r882-m4jm                                                                                                          | ReDoS                                                                                                        |
| `picomatch@>=4.0.0 <4.0.4`       | GHSA-26j4-r882-m4jm                                                                                                          | Same advisory, 4.x range                                                                                     |
| `rollup@>=4.0.0 <4.59.0`         | GHSA-gcx4-mw62-g3rm                                                                                                          | DOM clobbering in output                                                                                     |
| `serialize-javascript@<=7.0.4`   | GHSA-cqmj-v5x6-4hg7                                                                                                          | XSS via crafted object                                                                                       |
| `srvx@<0.11.13`                  | GHSA-4r4v-8rg6-5crc                                                                                                          | Open redirect                                                                                                |
| `tar@<=7.5.10`                   | GHSA-jg7w-cxjv-98c2                                                                                                          | Path traversal                                                                                               |
| `unhead@<=2.1.12`                | GHSA-gxhp-jfhg-5fv8, GHSA-95h2-gj7x-gx9w                                                                                     | XSS via meta tags + hasDangerousProtocol() bypass via leading-zero padded HTML entities                      |
| `vite@>=7.0.0 <7.3.2`            | GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583, GHSA-4w7w-66w2-5vf9                                                                | fs.deny bypass, arbitrary file read via WebSocket, path traversal in .map                                    |
| `yaml@>=2.0.0 <2.8.3`            | GHSA-4hm9-844j-jmxp                                                                                                          | Code execution via crafted YAML                                                                              |

The `ignoredOptionalDependencies` block suppresses 30 platform-specific native binaries (`@img/sharp-*`, `@resvg/resvg-js-*`) that are pulled in by `@nuxtjs/seo` 5.x's OG image engine. Only the host-platform binary is needed at build time.

## Notable Version Changes (v2.5.x)

- **TypeScript 5.9 -> 6.0:** Changes `erasableSyntaxOnly` default and tightens module resolution. Run `pnpm run build` to verify no type regressions after upgrading existing projects.
- **@nuxtjs/seo 3.4 -> 5.1:** Major rewrite (v4 was skipped). The OG image engine switched to `@shikijs/*` for syntax highlighting (SSR/build-time only). `nuxt.config.ts` SEO options are backwards-compatible. The 30 `ignoredOptionalDependencies` entries are required for clean installs.