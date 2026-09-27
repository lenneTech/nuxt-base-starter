---
name: starter-deferred-updates
description: Updates ncu keeps reporting in nuxt-base-starter that are deliberate holds (better-auth 1.7.6, vitest 5, TS 7, pnpm 12, @playwright/test, @vueuse/nuxt 15) and the exact condition that releases each.
metadata:
  type: project
---

State 2026-09-27 (maintenance before starter 2.26.0). After that run `ncu` showed ONLY these.
Each looks like a free bump; each has a reason. Check the release condition, not the version.

| Package (scope) | Held | Available | Release condition |
|---|---|---|---|
| `better-auth` + `@better-auth/passkey` (template) | 1.7.1 | 1.7.6 | Lock-step with nest-server + nuxt-extensions (peer `>=1.7.1 <1.8.0`). One coordinated release across all four repos. |
| `vitest` (template) | 4.1.11 | 5.x | `better-auth@1.7.1` peers `vitest ^2\|\|^3\|\|^4`; 1.7.6 adds `^5`. Take it WITH the better-auth bump. |
| `typescript` (template) | 6.0.3 | 7.x | vue-tsc needs `typescript/lib/tsc`, which TS 7's `exports` map omits. See nuxt-extensions memory `typescript-7-blocker`. |
| `pnpm` / `packageManager` (both) | 11.14.0 | 12.x | Stack-wide pin — never from a maintenance run. |
| `@playwright/test` (template) | 1.62.1 | 1.63.0 | lt-monorepo pins `mcr.microsoft.com/playwright:v1.62.1-noble` (3×: `.gitlab-ci.yml` ×2, `.github/workflows/test.yml` ×1). Bumping here alone turns `check:playwright-image` red in every generated project. Bump both in one release window. `tests/unit/playwright-image-contract.test.ts` checks it when `CHECK_CROSS_REPO=1`. |
| `@vueuse/nuxt` (template) | 14.4.0 | 15.0.0 | 15 pins `@vueuse/core@15.0.0`; `@nuxt/ui` (`^14.4.0`), `reka-ui` (`^14.1.0`), motion-v, nuxt-link-checker all sit on 14 → an extra core copy just for app auto-imports. App uses no vueuse composable directly, so no code change is needed once `npm view @nuxt/ui@latest dependencies.@vueuse/core` says `^15`. |

**Pending decision (not a hold):** root `brace-expansion@<5.0.9` override + `patches/minimatch@3.1.5.patch`
are no longer load-bearing — brace-expansion 1.1.18+ backports close the advisories on the 1.x
line minimatch@3 requests; a fresh resolve with neither gives 1.1.21, audit clean (2026-09-27).
Raised to 5.0.12 and documented in the yaml instead of removed, because removal needs Kai's call.

**Why:** each hold cost a trial or a cross-repo check to establish. **How to apply:** report these
as held with the reason; act only when the last column is true. Related: [[override-necessity-fresh-resolve-test]].
