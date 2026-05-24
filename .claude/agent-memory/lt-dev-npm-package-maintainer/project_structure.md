---
name: Project Structure
description: nuxt-base-starter has two-level package.json structure requiring checks in both locations
type: project
---

This repo has TWO package.json files requiring maintenance:

1. **Root** `/package.json` (package: `create-nuxt-base` v2.6.0+)
   - `dependencies`: cross-spawn, fs-extra (used by index.js scaffolding tool)
   - `devDependencies`: oxfmt, standard-version
   - Has its own `overrides` (in root `pnpm-workspace.yaml`, NOT package.json — see [[pnpm-version-reads-overrides]]) for standard-version's transitive deps (handlebars, lodash, brace-expansion, minimatch)

2. **Template** `/nuxt-base-template/package.json` (the actual Nuxt app template)
   - The bulk of the packages live here
   - `dependencies`: better-auth, @better-auth/passkey, @lenne.tech/nuxt-extensions, @nuxt/ui, tus-js-client, valibot, qrcode, etc.
   - `devDependencies`: nuxt, vitest, playwright, @nuxtjs/seo, typescript, etc.
   - Has extensive `overrides` + `ignoredOptionalDependencies` + build-script settings for security CVEs, in `nuxt-base-template/pnpm-workspace.yaml` (NOT package.json — see [[pnpm-version-reads-overrides]])
   - `vue` is an explicit devDependency (phantom-dep fix for pnpm 11 — see [[vue-phantom-dep-under-pnpm11]])

The `check` script in root runs `pnpm audit && pnpm run format:check && cd nuxt-base-template && pnpm run check`. The template check covers: audit + format + lint + unit tests + build + server-start verification (`scripts/check-server-start.sh`, which boots `.output/server/index.mjs` on a free port and self-terminates — no lingering processes).

**npm-mode peer contract (do NOT move to devDeps or remove):** This template runs in npm mode (no `app/core/VENDOR.md`). `@lenne.tech/nuxt-extensions` declares `better-auth`, `@better-auth/passkey`, `tus-js-client`, `nuxt`, and `@playwright/test` as PEER dependencies. So `better-auth`, `@better-auth/passkey`, `tus-js-client` must stay in `dependencies` (runtime, consumed via `useLtAuthClient()` / `useLtTusUpload()` — they have NO direct import in app/server, only via composables). `@playwright/test` correctly stays in devDependencies.

**No unused packages / no recategorization needed** (verified 2026-05-24): every dep is used directly, via nuxt.config modules, via config files (tailwind plugin, openapi-ts, vitest), via package.json scripts (rimraf, lint-staged, simple-git-hooks), via icon auto-discovery (@iconify-json/lucide), or via the peer contract. `mongodb` is used only in e2e specs (correct in devDeps).

**Why:** Maintained 2026-04-17, updated 2026-05-24. The structure ensures the scaffolding tool (root) and the generated project (template) are independently versioned.
