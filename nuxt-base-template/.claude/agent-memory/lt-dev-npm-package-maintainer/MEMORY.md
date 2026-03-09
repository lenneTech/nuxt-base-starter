# NPM Package Maintainer Memory - nuxt-base-template

## Project Basics
- Package manager: pnpm (pnpm-lock.yaml present)
- Type: Private Nuxt 4 template (not a library)
- Test command: `pnpm run test:unit` (vitest, 43 tests in 2 files)
- Build command: `pnpm run build` (nuxt build)

## Key Dependency Patterns
- `better-auth`, `@better-auth/passkey`, `tus-js-client` are peer dependencies of `@lenne.tech/nuxt-extensions` - keep in `dependencies`
- `@nuxt/ui` and `@vueuse/nuxt` belong in `dependencies` (used in app/ source files with type imports)
- pnpm sometimes auto-moves packages to devDependencies during `-D` updates - watch and fix

## Security Overrides
- Overrides are in `pnpm.overrides` (inside the `pnpm` key), NOT a top-level `overrides` key
- `pnpm audit --fix` outputs proposed overrides as JSON (does not apply automatically)
- `pnpm install` must be run after adding/updating overrides to re-resolve lockfile
- `nanotar` vulnerability from nuxt has NO patched version (`<0.0.0`) - cannot be fixed

## Deprecated Package Notes
- `@hey-api/client-fetch`: deprecated ("bundled in @hey-api/openapi-ts since v0.73.0") but still a valid runtime HTTP client for generated API SDKs - KEEP in dependencies
- `openapi-ts.config.ts` uses deprecated `lint`/`format` options; use `postProcess: ['eslint', 'prettier']` instead
- `@nuxtjs/color-mode`: do NOT add to devDeps - @nuxt/ui brings its own 3.x internally; 4.0.0 would conflict

## Override Cleanup Notes (2026-03-09)
Removed as no longer needed:
- `devalue@<=5.6.2` - nuxt requires ^5.6.2, latest is 5.6.3 (always picked)
- `fast-xml-parser@>=5.0.0 <5.3.8` - @nuxtjs/sitemap requires ^5.3.3, latest is 5.4.2 (always safe)
- `markdown-it@>=13.0.0 <14.1.1` - prosemirror-markdown requires ^14.0.0, latest is 14.1.1 (always picked)
- `minimatch@>=5.0.0 <5.1.8` - readdir-glob installs minimatch 5.1.9 which is already >=5.1.8 (safe)

Still required (keep these overrides):
- `@hono/node-server@<1.19.10` - @prisma/dev requires 1.19.9 exactly
- `hono@<4.12.4` - @prisma/dev requires 4.11.4 exactly
- `lodash@>=4.0.0 <=4.17.22` - @chevrotain/gast requires 4.17.21 exactly (vulnerable)
- `minimatch@>=9.0.0 <9.0.7` - editorconfig 1.0.4 requires 9.0.1 exactly (in vulnerable range)
- `rollup@>=4.0.0 <4.59.0` - vite requires ^4.43.0 which could pick <4.59.0
- `serialize-javascript@<=7.0.2` - @rollup/plugin-terser requires ^6.0.1 (6.x is vulnerable)
- `svgo@=4.0.0` - postcss-svgo requires ^4.0.0 which could pick 4.0.0 (vulnerable)
- `tar@<=7.5.9` - @mapbox/node-pre-gyp requires ^7.4.0 (7.4.x is vulnerable)

## Version History (2026-03-09)
After maintenance, all packages at latest:
- `@lenne.tech/nuxt-extensions`: 1.3.0
- `nuxt`: 4.3.1
- `vitest`: 4.0.18 (major from 3.x)
- `@nuxt/test-utils`: 4.0.0 (major from 3.x, requires vitest ^4.0.2)
- `vitest` v4 + `@nuxt/test-utils` v4 must be updated together (compatibility requirement)
- Residual vulnerabilities: 1 moderate (nanotar, unfixable)
- Removed: `@nuxtjs/color-mode` from devDeps (unused, conflicts with @nuxt/ui's internal 3.5.2)
