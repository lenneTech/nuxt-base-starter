---
name: workspace-yaml-embedding-risk
description: Template's pnpm-workspace.yaml is NOT picked up by lt CLI's hoist step when embedded as projects/app in lt-monorepo — overrides would be lost there
metadata:
  type: project
---

The template's pnpm settings now live in `nuxt-base-template/pnpm-workspace.yaml` (see [[pnpm-version-reads-overrides]]). This is correct for STANDALONE template usage. But there is an unresolved embedding gap for the lt-monorepo path that needs a human/CLI decision.

**The gap:** `lt fullstack init` embeds the template as `projects/app` inside `lt-monorepo` (which has its own root `pnpm-workspace.yaml` with `packages: - 'projects/*'`). The CLI's `flattenNuxtBaseTemplate` (cli `src/extensions/frontend-helper.ts`) copies the WHOLE template dir into `projects/app/` — including a `pnpm-workspace.yaml`. Then `hoistWorkspacePnpmConfig` (cli `src/lib/hoist-workspace-pnpm-config.ts`, called from `commands/fullstack/init.ts`, `add-app.ts`, `add-api.ts`) hoists workspace-scoped pnpm config to the monorepo root — but it reads ONLY from `subPkg.pnpm` in `projects/app/package.json`, which is now EMPTY. So:
1. The 32 security overrides would NOT be hoisted to the monorepo root → CVE regression in monorepo installs.
2. A nested `projects/app/pnpm-workspace.yaml` inside the monorepo workspace is a nested-workspace conflict (pnpm treats it as a second workspace root).

**Why:** Verified 2026-05-24 by reading the lt CLI source (`/Users/kaihaase/code/lenneTech/cli`). The hoist function predates the package.json→pnpm-workspace.yaml migration and only knows about `package.json#pnpm`.

**How to apply:** Flag this whenever touching either the template's pnpm config OR the lt CLI's init/flatten/hoist code. The fix belongs in the lt CLI: `hoistWorkspacePnpmConfig` should ALSO read `projects/<app>/pnpm-workspace.yaml` (overrides/ignoredOptionalDependencies/allowBuilds/onlyBuiltDependencies) and merge into the monorepo root, AND the flatten step should delete the nested `projects/app/pnpm-workspace.yaml` after hoisting. Until that CLI change ships, standalone template installs are correct but `lt fullstack init`-generated monorepos may install without the template's overrides. This is a human decision (CLI change in a different repo).
