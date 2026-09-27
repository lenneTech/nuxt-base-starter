---
name: Project Structure
description: nuxt-base-starter has two-level package.json structure requiring checks in both locations
type: project
---

This repo has TWO package.json files requiring maintenance:

1. **Root** `/package.json` (package: `create-nuxt-base`, `private: true` — the scaffolder, never shipped to customers, not in any Docker build)
   - `dependencies`: cross-spawn, fs-extra (used by index.js scaffolding tool)
   - `devDependencies`: oxfmt, standard-version
   - Root `pnpm-workspace.yaml` now has **NO overrides** (was 4; all became dead once standard-version's tree resolved to patched versions on its own — verified 2026-07-16). The legacy `//overrides` doc block in root package.json was removed with them.

2. **Template** `/nuxt-base-template/package.json` (the actual Nuxt app template → `projects/app`)
   - The bulk of the packages live here.
   - `pnpm-workspace.yaml` holds overrides + `ignoredOptionalDependencies` (30) + build-script settings — NOT package.json (see [[pnpm-version-reads-overrides]]). Overrides are down to **3** (from 32) as of 2026-07-16; validate any change with [[override-necessity-fresh-resolve-test]].
   - `vue` is an explicit devDependency (phantom-dep fix for pnpm 11 — see [[vue-phantom-dep-under-pnpm11]]).

The `check` script in root runs install + `pnpm audit` + `pnpm peers check` + its own script tests + format check, then `cd nuxt-base-template && pnpm run check`. The template check (`scripts/check.mjs` → `check:raw`) covers audit + peers + format + lint + unit tests + build + `typecheck` (vue-tsc, app/ + server/) + `typecheck:tests` (tsc, tests/) + server-start (`scripts/check-server-start.mjs`, Node since 2026-09-23, self-terminating, no lingering processes).

**The gate typechecks** — tests since `fba4ee0` (2026-07-20), app/ + server/ since `4661b86` (2026-08-12). Before that a green `check` proved nothing about TypeScript; now it does. (TS 7 is separately blocked: `@nuxt/ui` peers `typescript: ^5.6.3 || ^6.0.0`.)

**npm-mode peer contract (do NOT move to devDeps or remove):** This template runs in npm mode (no `app/core/VENDOR.md`). `@lenne.tech/nuxt-extensions` (1.9.0) declares `better-auth`, `@better-auth/passkey`, `tus-js-client`, `nuxt`, `@playwright/test` as PEER deps. So `better-auth`, `@better-auth/passkey`, `tus-js-client` stay in `dependencies` (consumed via composables, no direct import). `@playwright/test` correctly stays in devDependencies.

**No direct import but must NOT be removed** (each re-verified 2026-07-16):
- `pinia` — required (non-optional) peer of `@pinia/nuxt`; nuxt.config.ts documents this inline at the module entry. Template ships zero stores; it is deliberate scaffolding for consumers.
- `@types/qrcode` — `qrcode@1.5.4` ships NO bundled types.
- `@iconify-json/lucide` (icon auto-discovery); `rimraf`/`lint-staged`/`simple-git-hooks` (scripts/hooks); `mongodb` (e2e specs only, correct in devDeps).

**Removed 2026-07-16 (genuinely unused):** `@vue/test-utils` (only an *optional* peer of `@nuxt/test-utils`; zero unit tests mount components — they only import `vitest`/`vue`) and `@nuxt/devtools` (framework mirror — `nuxt@4.4.x` itself depends on `@nuxt/devtools: ^3.2.4`, and it appears in no config or import).

**Why:** Maintained 2026-04-17, 2026-05-24, 2026-07-16. The structure keeps the scaffolder (root) and the generated project (template) independently versioned.
