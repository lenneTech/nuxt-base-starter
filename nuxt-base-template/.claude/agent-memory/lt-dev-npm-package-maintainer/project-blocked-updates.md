---
name: project-blocked-updates
description: standing list of template/root updates that are deliberately held back (TS 7, @playwright/test, @vueuse/nuxt 15, pnpm), with the condition that unblocks each
metadata:
  type: project
---

Deliberate holds — re-check each condition per run, do not re-litigate the analysis.
State 2026-10-07 (maintenance before starter 2.31.0). After that run `ncu` showed ONLY these.

- **typescript 7.x** (template, held at 6.0.3) — vue-tsc 3.3.12 resolves
  `typescript/lib/tsc`, which TS 7's `exports` map does not provide. Its only "TS 7" path
  is `typescript` aliased to `@typescript/typescript6` (then it loads `@typescript/old`),
  i.e. still TS 6 under another name — not an upgrade. Unblocks when a vue-tsc release
  drives the TS 7 native compiler; verify in a scratch copy with `pnpm run typecheck`.
- **@playwright/test 1.63** (template, held at 1.62.1) — lt-monorepo pins
  `mcr.microsoft.com/playwright:v1.62.1-noble` (`.gitlab-ci.yml` x2, `.github/workflows/test.yml`
  x1) and its `scripts/check-playwright-image.mjs` compares that tag with
  `projects/app/package.json` — i.e. this template. Bumping here alone turns every freshly
  generated project's `check` red. Bump both in one release window. Check:
  `grep -rn "playwright:v" ~/code/lenneTech/lt-monorepo/.gitlab-ci.yml`.
- **@vueuse/nuxt 15** (template, held at 14.4.0) — 15 hard-depends on `@vueuse/core@15.0.0`
  while `@nuxt/ui` 4.11.3 (its newest) requests `^14.4.0` → two core majors in every generated
  project; a direct `import from '@vueuse/core'` then gets whichever copy is hoisted
  (shamefully-hoist) while auto-imports get 15. The template's own code uses no vueuse
  composable, so the bump buys nothing here. Unblocks when
  `npm view @nuxt/ui@latest dependencies.@vueuse/core` says `^15`; no code change needed then.
- **pnpm / `packageManager`** (both, 11.14.0) — stack-wide SSOT pin (nest-server and
  nest-server-starter on 11.13.1, nuxt-extensions and lt-monorepo on 11.14.0, contract tests
  in each). 12.x is a major (engines `^11.0.0` coupling); even 11.28.x belongs to a
  coordinated stack bump, not a single-repo maintenance run.
- **better-auth / @better-auth/passkey** — not a hold but a lock-step: see
  [[project-better-auth-tracks-nest-server]].

Cleared holds worth remembering (so they are not re-flagged as risky):

- nuxt 4.6.0 taken 2026-10-07 (see [[project-nuxt-46-node-floor]]); brought `@nuxt/cli` 4 and
  cssnano 9 without any code change.
- better-auth 1.7.x cleared once nest-server moved to 1.7; now 1.7.7 in lock-step.
- vitest 5 cleared 2026-10-03 together with better-auth 1.7.7.
- `@nuxtjs/plausible` 3 → 4 was a **safe** major on 2026-08-22 (options diff docs-only).