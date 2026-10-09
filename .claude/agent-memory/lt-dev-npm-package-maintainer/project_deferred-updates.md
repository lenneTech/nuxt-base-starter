---
name: starter-deferred-updates
description: Updates ncu keeps reporting in nuxt-base-starter that are deliberate holds (TS 7, pnpm 12, @playwright/test, @vueuse/nuxt 15) and the exact condition that releases each.
metadata:
  type: project
---

State 2026-10-03 (maintenance before starter 2.29.0). After that run `ncu` showed ONLY these.
Each looks like a free bump; each has a reason. Check the release condition, not the version.

| Package (scope) | Held | Available | Release condition |
|---|---|---|---|
| `typescript` (template) | 6.0.3 | 7.x | vue-tsc needs `typescript/lib/tsc`, which TS 7's `exports` map omits. See nuxt-extensions memory `typescript-7-blocker`. |
| `pnpm` / `packageManager` (both) | 11.28.5 | 12.x | 11.x minors move with maintenance (`corepack up`): Kai decided 2026-10-09 to take 11.14.0 → 11.28.5 in 2.31.4 alone and asked the other base repos to follow with their own maintain run. 12.x stays held: `engines.pnpm ^11.0.0` here and in lt-monorepo → `ERR_PNPM_UNSUPPORTED_ENGINE` in every generated project; needs a coordinated stack major. |
| `@playwright/test` (template) | 1.62.1 | 1.64.0 | lt-monorepo pins `mcr.microsoft.com/playwright:v1.62.1-noble` (3×: `.gitlab-ci.yml` ×2, `.github/workflows/test.yml` ×1). Bumping here alone turns `check:playwright-image` red in every generated project. Bump both in one release window (the v1.63.0-noble image exists). `tests/unit/playwright-image-contract.test.ts` checks it when `CHECK_CROSS_REPO=1`. |
| `@vueuse/nuxt` (template) | 14.4.0 | 15.0.0 | 15 pins `@vueuse/core@15.0.0`; `@nuxt/ui` 4.11.3 (`^14.4.0`), `reka-ui` (`^14.1.0`), motion-v, nuxt-link-checker all sit on 14 → an extra core copy just for app auto-imports. App uses no vueuse composable directly, so no code change is needed once `npm view @nuxt/ui@latest dependencies.@vueuse/core` says `^15`. |

Cleared 2026-10-03: better-auth + passkey (now 1.7.7, lock-step with nest-server 11.41.8 and
nuxt-extensions 1.18.4) and vitest 5 (taken with it, 5.0.3).

**Resolved 2026-10-07 (maintenance before 2.31.0):** the root `brace-expansion` override and
`patches/minimatch@3.1.5.patch` were REMOVED (fresh resolve without either: brace-expansion
1.1.21, audit clean), and so was the template's inert `unhead` pin. Parking proven-inert
overrides "for Kai's call" was wrong: his standing policy (minimal overrides, each needs an
audit proof) is the call. All four holds above were re-measured that day and still hold. The
current list lives in the template memory: `nuxt-base-template/.claude/agent-memory/
lt-dev-npm-package-maintainer/project-blocked-updates.md`.

**Why:** each hold cost a trial or a cross-repo check to establish. **How to apply:** report these
as held with the reason; act only when the last column is true. Related: [[override-necessity-fresh-resolve-test]].
