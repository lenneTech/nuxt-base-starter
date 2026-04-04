# nuxt-base-starter

## Project Overview

Starter template for Nuxt 4 applications using the lenne.tech stack. Used by `lt fullstack init` to scaffold new frontend projects.

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

This project depends on `@lenne.tech/nuxt-extensions`. The framework source is available in `node_modules/@lenne.tech/nuxt-extensions/` and **MUST** be read when using or debugging framework features.

### Key Source Files (in node_modules/@lenne.tech/nuxt-extensions/)

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

1. **ALWAYS read actual source code** from `node_modules/@lenne.tech/nuxt-extensions/` before guessing framework behavior
2. **NEVER re-implement** functionality that nuxt-extensions already provides — check composables first
3. **Use `useBetterAuth()`** for authentication — never implement auth manually
4. **When debugging auth issues**, read the auth proxy server route and middleware source
5. **Check `dist/runtime/composables/`** before creating new composables — may already exist

## Security Overrides (pnpm)

The `pnpm.overrides` in `package.json` force vulnerable transitive dependencies to patched versions. Each override addresses a specific CVE or security advisory:

| Override                         | Advisory            | Notes                                                                               |
| -------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `@hono/node-server@<1.19.10`     | GHSA-7256-2wf4-hf2r | Request smuggling                                                                   |
| `brace-expansion@>=2.0.0 <2.0.3` | GHSA-f886-m6hf-6m8v | ReDoS via zero-step sequences                                                       |
| `brace-expansion@>=4.0.0 <5.0.5` | GHSA-f886-m6hf-6m8v | Same advisory, 5.x range                                                            |
| `readdir-glob@<2.0.3`            | (transitive)        | Forces minimatch upgrade for brace-expansion fix                                    |
| `defu@<=6.1.4`                   | GHSA-mchp-fgcf-hmfj | Prototype pollution                                                                 |
| `devalue@<=5.6.3`                | GHSA-77p6-w3v8-rqwf | XSS via crafted input                                                               |
| `effect@<3.20.0`                 | GHSA-j44v-mmf2-xvm9 | Denial of service                                                                   |
| `h3@<1.15.9`                     | GHSA-wr4h-v87w-p3r7 | Path traversal                                                                      |
| `h3@>=2.0.0-0 <2.0.1-rc.18`      | GHSA-q5pr-72pq-83v3 | Cookie DoS + SSE injection                                                          |
| `h3-next`                        | (alias fix)         | `@nuxt/test-utils` pins h3-next to vulnerable RC; remove when h3 v2 stable releases |
| `hono@<4.12.7`                   | GHSA-rp6g-89hg-4gfv | SSRF via host header                                                                |
| `kysely@>=0.26.0 <=0.28.13`      | GHSA-4hxq-5gxr-453h | SQL injection                                                                       |
| `lodash@>=4.0.0 <=4.17.23`       | GHSA-x5rq-j2xg-h7qm | Prototype pollution                                                                 |
| `minimatch@>=9.0.0 <9.0.7`       | GHSA-f886-m6hf-6m8v | ReDoS via brace-expansion                                                           |
| `node-forge@<1.4.0`              | GHSA-997c-fj8j-rq5h | RSA signature forgery                                                               |
| `picomatch@<2.3.2`               | GHSA-26j4-r882-m4jm | ReDoS                                                                               |
| `picomatch@>=4.0.0 <4.0.4`       | GHSA-26j4-r882-m4jm | Same advisory, 4.x range                                                            |
| `rollup@>=4.0.0 <4.59.0`         | GHSA-gcx4-mw62-g3rm | DOM clobbering in output                                                            |
| `serialize-javascript@<=7.0.4`   | GHSA-cqmj-v5x6-4hg7 | XSS via crafted object                                                              |
| `srvx@<0.11.13`                  | GHSA-4r4v-8rg6-5crc | Open redirect                                                                       |
| `tar@<=7.5.10`                   | GHSA-jg7w-cxjv-98c2 | Path traversal                                                                      |
| `unhead@<=2.1.10`                | GHSA-gxhp-jfhg-5fv8 | XSS via meta tags                                                                   |
| `yaml@>=2.0.0 <2.8.3`            | GHSA-4hm9-844j-jmxp | Code execution via crafted YAML                                                     |

The `ignoredOptionalDependencies` block suppresses 30 platform-specific native binaries (`@img/sharp-*`, `@resvg/resvg-js-*`) that are pulled in by `@nuxtjs/seo` 5.x's OG image engine. Only the host-platform binary is needed at build time.

## Notable Version Changes (v2.5.x)

- **TypeScript 5.9 -> 6.0:** Changes `erasableSyntaxOnly` default and tightens module resolution. Run `pnpm run build` to verify no type regressions after upgrading existing projects.
- **@nuxtjs/seo 3.4 -> 5.1:** Major rewrite (v4 was skipped). The OG image engine switched to `@shikijs/*` for syntax highlighting (SSR/build-time only). `nuxt.config.ts` SEO options are backwards-compatible. The 30 `ignoredOptionalDependencies` entries are required for clean installs.
