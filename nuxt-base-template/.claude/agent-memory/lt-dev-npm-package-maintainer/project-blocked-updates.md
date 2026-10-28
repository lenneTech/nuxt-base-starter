---
name: project-blocked-updates
description: standing list of template/root updates that are deliberately held back (TS 7, @vueuse/nuxt 15, pnpm 12), with the condition that unblocks each
metadata:
  type: project
---

Deliberate holds — re-check each condition per run, do not re-litigate the analysis.
State 2026-10-07 (maintenance before starter 2.31.0). After that run `ncu` showed ONLY these.
Re-measured 2026-10-11 (before 2.31.8): all four still held; 11.28.5 is still the newest pnpm 11.x.
Re-measured 2026-10-12 (before 2.32.0): all four still held (lt-monorepo image v1.62.1, @nuxt/ui 4.11.3
on `@vueuse/core ^14.4.0`, vue-tsc 3.3.13 still resolves `typescript/lib/tsc`, 11.28.5 newest 11.x).
Only vue-tsc 3.3.12 -> 3.3.13 was taken. Left at the release-age gate, NOT holds: `happy-dom` 21.0.x
(a MAJOR, 7h old — evaluate it next run: changelog + full gate, it backs vitest's DOM env and
@nuxt/test-utils' types, see the happy-dom note in the template CLAUDE.md) and
`@iconify-json/lucide` 1.2.143 (1.5h old).
Re-measured 2026-10-24 (better-auth 1.7.12 round): TS 7 still held (vue-tsc 3.3.13 is still the
newest), @vueuse/nuxt 15 still held (@nuxt/ui 4.12.0 still requests `@vueuse/core ^14.4.0`), pnpm 12
still held. @playwright/test CLEARED (see below). happy-dom 21.0.4 taken: its only breaking change
is CSS/iframe loading off by default (SSRF), 21.0.2-21.0.4 are security fixes, the unit suite
(581 tests) passed unchanged. pnpm 11.28.5 -> 11.28.8 in both package.json files.
Re-measured 2026-10-28 (nuxt 4.6.3 round): TS 7, @vueuse/nuxt 15 (@nuxt/ui 4.12.0 still `^14.4.0`),
pnpm 12 still held. better-auth 1.7.13/1.7.14 exist but stay at 1.7.12 (lock-step, passkey 1.7.13+
needs better-auth at its own version). pnpm 11.28.8 -> 11.28.9 (fixes GHSA-xjj6-f33q-929c in pnpm's
own undici). The `+sha512.` value needs no corepack: it is the registry `dist.integrity` decoded from
base64 to hex (`Buffer.from(b64,'base64').toString('hex')`); verified byte-identical on 11.28.8.

- **typescript 7.x** (template, held at 6.0.3, TS 7.0.2 available) — vue-tsc 3.3.13 (same as 3.3.12) resolves
  `typescript/lib/tsc`, which TS 7's `exports` map does not provide. Its only "TS 7" path
  is `typescript` aliased to `@typescript/typescript6` (then it loads `@typescript/old`),
  i.e. still TS 6 under another name — not an upgrade. Unblocks when a vue-tsc release
  drives the TS 7 native compiler; verify in a scratch copy with `pnpm run typecheck`.
- **@playwright/test** — not a hold but a cross-repo lock-step: lt-monorepo pins
  `mcr.microsoft.com/playwright:vX.Y.Z-noble` (`.gitlab-ci.yml` x2, `.github/workflows/test.yml`
  x1) and its `scripts/check-playwright-image.mjs` compares that tag with
  `projects/app/package.json`, i.e. this template. Bumping here alone turns every freshly
  generated project's `check` red, so both repos move and release together. Check:
  `grep -rn "playwright:v" ~/code/lenneTech/lt-monorepo/.gitlab-ci.yml`.
- **@vueuse/nuxt 15** (template, held at 14.4.0) — 15 hard-depends on `@vueuse/core@15.0.0`
  while `@nuxt/ui` 4.11.3 (its newest) requests `^14.4.0` → two core majors in every generated
  project; a direct `import from '@vueuse/core'` then gets whichever copy is hoisted
  (shamefully-hoist) while auto-imports get 15. The template's own code uses no vueuse
  composable, so the bump buys nothing here. Unblocks when
  `npm view @nuxt/ui@latest dependencies.@vueuse/core` says `^15`; no code change needed then.
  The module itself STAYS in the template although the template's own code uses none of it
  (Kai's decision 2026-10-24): 10 of 18 current projects rely on its auto-imports, it adds no
  endpoint and bundles only what is used. Do not flag it as "unused" in a maintenance run.
  `@nuxt/image` was removed the same day for the opposite reason (unused in 13 of 18 projects,
  `/_ipx` broken in the alpine image because the sharp binaries were ignored).
- **pnpm 12** (both, on 11.28.5) — 12.x is a major: `engines.pnpm ^11.0.0` here and in
  lt-monorepo turns it into `ERR_PNPM_UNSUPPORTED_ENGINE` in every generated project, so it
  needs a coordinated stack bump. 11.x minors are NOT held: Kai decided 2026-10-09 to take
  11.14.0 → 11.28.5 in 2.31.4 via `corepack up` in a single-repo maintenance run and asked
  the other base repos to follow with their own maintain run. The lt CLI hoists the highest
  sub-project pin to the monorepo root, so a temporary spread across repos is harmless.
- **better-auth / @better-auth/passkey** — not a hold but a lock-step: see
  [[project-better-auth-tracks-nest-server]].

Cleared holds worth remembering (so they are not re-flagged as risky):

- nuxt 4.6.0 taken 2026-10-07 (see [[project-nuxt-46-node-floor]]); brought `@nuxt/cli` 4 and
  cssnano 9 without any code change.
- better-auth 1.7.x cleared once nest-server moved to 1.7; 1.7.7 in lock-step, then 1.7.12
  (2026-10-24, with nest-server 12.0.0 and nuxt-extensions 1.20.0).
- @playwright/test 1.62.1 -> 1.64.1 cleared 2026-10-24: the lt-monorepo session raised its three
  image pins to v1.64.1-noble in the same round (the tag exists on mcr.microsoft.com).
- vitest 5 cleared 2026-10-03 together with better-auth 1.7.7.
- `@nuxtjs/plausible` 3 → 4 was a **safe** major on 2026-08-22 (options diff docs-only).