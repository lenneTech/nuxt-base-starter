---
name: Override Safety Rule
description: All pnpm.overrides targets must use fixed versions, never unbounded ranges
type: feedback
---

All `pnpm.overrides` target values (right-hand side) MUST be fixed versions — never `>=X`, `^X`, `~X`, or `*`.

**Why:** In April 2026 an unbounded override `"vite@>=7.0.0 <=7.3.1": ">=7.3.2"` caused pnpm to install `vite@8.0.8` (major version jump), breaking peer dependencies in `@nuxt/test-utils`, dropping `drizzle-orm` from `better-auth`, and causing 13 e2e test regressions.

**How to apply:** When writing or reviewing overrides, always pin to a specific version like `"7.3.2"`. The selector on the LEFT can use ranges (to scope which vulnerable versions are replaced); the value on the RIGHT must be exact.

Before this maintenance session (2026-04-17) ALL overrides in nuxt-base-template/package.json had unbounded targets (`>=X`). They were all fixed to exact version strings.
