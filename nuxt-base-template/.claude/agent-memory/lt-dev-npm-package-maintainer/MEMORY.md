# NPM Package Maintainer Memory - nuxt-base-template

## Project Basics

- Package manager: pnpm (pnpm-lock.yaml present)
- Type: Private Nuxt 4 template (not a library)
- Test command: `pnpm run test:unit` (vitest, 43 tests in 2 files)
- Build command: `pnpm run build` (nuxt build)

## Key Dependency Patterns

- `better-auth`, `@better-auth/passkey`, `tus-js-client` are peer dependencies of `@lenne.tech/nuxt-extensions` - keep in `dependencies`
- `@nuxt/ui` and `@vueuse/nuxt` belong in `dependencies` (used in app/ source files with type imports)
- `@hey-api/client-fetch`: deprecated, moved to devDependencies (only used in openapi-ts.config.ts codegen config)
- pnpm sometimes auto-moves packages to devDependencies during `-D` updates - watch and fix

## Security Overrides

- Overrides are in `pnpm.overrides` (inside the `pnpm` key), NOT a top-level `overrides` key
- `pnpm audit --fix` outputs proposed overrides as JSON (does not apply automatically)
- `pnpm install` must be run after adding/updating overrides to re-resolve lockfile
- `nanotar` vulnerability from nuxt has NO patched version (`<0.0.0`) - cannot be fixed

## Deprecated Package Notes

- `@hey-api/client-fetch`: deprecated ("bundled in @hey-api/openapi-ts since v0.73.0"), moved to devDependencies (codegen config only, no runtime use)
- `openapi-ts.config.ts`: migrated from deprecated `lint`/`format` options to `postProcess: ['oxlint', 'oxfmt']`
- `@nuxtjs/color-mode`: do NOT add to devDeps - @nuxt/ui brings its own 3.x internally; 4.0.0 would conflict

## Override Cleanup Notes (2026-03-16)

Removed as no longer needed:

- `svgo@=4.0.0` - postcss-svgo now requires ^4.0.1, so 4.0.0 is never picked
- `devalue@<=5.6.2` (old) - replaced with `devalue@<=5.6.3` to cover new vulnerability in 5.6.3

Updated overrides:

- `hono@<4.12.4` → `hono@<4.12.7` - new vulnerability discovered in <4.12.7
- `tar@<=7.5.9` → `tar@<=7.5.10` - new vulnerability discovered in 7.5.10
- Added `devalue@<=5.6.3` - new vulnerability in devalue <=5.6.3 (proto pollution)
- Added `unhead@<=2.1.10` - new vulnerability in unhead <=2.1.10

Still required (keep these overrides):

- `@hono/node-server@<1.19.10` - @prisma/dev requires 1.19.9 exactly
- `devalue@<=5.6.3` - nuxt requires ^5.6.3 which picks vulnerable 5.6.3; 5.6.4 is safe
- `hono@<4.12.7` - @prisma/dev requires 4.11.4 exactly (new vuln <4.12.7)
- `lodash@>=4.0.0 <=4.17.22` - @chevrotain/gast requires 4.17.21 exactly (vulnerable)
- `minimatch@>=9.0.0 <9.0.7` - editorconfig 1.0.4 requires 9.0.1 exactly (in vulnerable range)
- `rollup@>=4.0.0 <4.59.0` - vite requires range that could pick <4.59.0
- `serialize-javascript@<=7.0.2` - nitropack uses @rollup/plugin-terser@0.4.4 which requires ^6.0.1 (6.x is vulnerable)
- `tar@<=7.5.10` - @mapbox/node-pre-gyp requires ^7.4.0 (7.4.x-7.5.10 are vulnerable)
- `unhead@<=2.1.10` - @nuxt/ui/@nuxtjs/seo use @unhead/vue which pulls vulnerable unhead

## Version History (2026-03-16)

After maintenance, all packages at latest:

- `@better-auth/passkey`: 1.5.5 (from 1.5.4)
- `better-auth`: 1.5.5 (from 1.5.4)
- `@lenne.tech/nuxt-extensions`: 1.5.0
- `@iconify-json/lucide`: 1.2.98 (from 1.2.96)
- `@vitejs/plugin-vue`: 6.0.5 (from 6.0.4)
- `happy-dom`: 20.8.4 (from 20.8.3)
- `@types/node`: 25.5.0 (from 25.4.0)
- `lint-staged`: 16.4.0 (from 16.3.2)
- `nuxt`: 4.4.2 (from 4.3.1)
- `vitest`: 4.1.0 (from 4.0.18)
- `@hey-api/openapi-ts`: 0.94.2 (from 0.94.0)
- `jsdom`: 29.0.0 (from 28.1.0) - fixes undici vulnerabilities (jsdom 29 requires undici ^7.24.3)
- Residual vulnerabilities: 0
- `@hey-api/client-fetch`: moved from dependencies → devDependencies
