---
name: Project Structure
description: nuxt-base-starter has two-level package.json structure requiring checks in both locations
type: project
---

This repo has TWO package.json files requiring maintenance:

1. **Root** `/package.json` (package: `create-nuxt-base` v2.6.0+)
   - `dependencies`: cross-spawn, fs-extra (used by index.js scaffolding tool)
   - `devDependencies`: oxfmt, standard-version
   - Has its own `pnpm.overrides` for standard-version's transitive deps (handlebars, lodash, brace-expansion, minimatch)

2. **Template** `/nuxt-base-template/package.json` (the actual Nuxt app template)
   - The bulk of the packages live here
   - `dependencies`: better-auth, @better-auth/passkey, @lenne.tech/nuxt-extensions, @nuxt/ui, tus-js-client, valibot, qrcode, etc.
   - `devDependencies`: nuxt, vitest, playwright, @nuxtjs/seo, typescript, etc.
   - Has extensive `pnpm.overrides` for security CVEs

The `check` script in root runs `cd nuxt-base-template && pnpm run check` which covers: audit + format + lint + unit tests + build + server-start verification.

**Why:** Maintained as 2026-04-17. The structure ensures the scaffolding tool (root) and the generated project (template) are independently versioned.
