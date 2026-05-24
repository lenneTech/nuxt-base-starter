---
name: vue-phantom-dep-under-pnpm11
description: vue must stay an explicit devDependency in the template — pnpm 11's strict hoisting breaks the unit-test mock's bare `vue` import otherwise
metadata:
  type: feedback
---

`nuxt-base-template` declares `vue` as an explicit devDependency (pinned to the version Nuxt resolves, currently `3.5.33`). Do NOT remove it as "unused" — it has no direct app import, only a test-file import.

**Why:** Discovered 2026-05-24 during the pnpm 10→11 migration. `tests/unit/mocks/auth-client.mock.ts` does `import { ref } from 'vue'`. Under pnpm 10's loose hoisting, `vue` (a transitive of nuxt/@nuxt/ui) was hoisted to top-level node_modules so the bare import resolved. pnpm 11's stricter layout does NOT hoist it, so vitest failed with `Failed to resolve import "vue"` and a whole suite (auth.spec.ts) errored out. Adding `vue` as an explicit devDependency restores a top-level `node_modules/vue` symlink and fixes resolution WITHOUT touching any test file (constraint: tests are immutable).

**How to apply:** Keep `vue` in the template's devDependencies. Pin it to the same patch Nuxt's importer resolves (check the lockfile: `grep "^      nuxt:" -A2 pnpm-lock.yaml` → the `(vue@3.5.X` suffix). If a future maintenance run sees a vitest "cannot resolve vue" error, this is the cause. The general principle (see [[project-structure]]): a package imported in test code must be a declared dependency, not a phantom hoist.
