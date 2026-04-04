---
name: Dependency Maintenance Pattern
description: Security override conventions observed in nuxt-base-template — open upper bounds and h3-next RC alias are intentional
type: project
---

Security overrides in `package.json` (pnpm.overrides) intentionally use open-upper-bound `>=X.Y.Z` targets rather than pinned ranges. This is the project's deliberate convention so that future patch releases of vulnerable dependencies are automatically picked up.

The `h3-next` alias is pinned to `npm:h3@2.0.1-rc.20` because the Nuxt/Nitro ecosystem uses h3 v2 in pre-release form; this is a necessary compatibility shim.

**Why:** Reviewed during 2026-04-04 dependency maintenance update (PR: TypeScript 5.9→6.0, @nuxtjs/seo 3.4→5.1, 14 overrides added/updated).

**How to apply:** Do not flag open-upper-bound `>=` override targets as findings unless they allow a known-malicious version. Flag only if the lower bound is incorrect (allows still-vulnerable versions) or the target package name is suspicious.
