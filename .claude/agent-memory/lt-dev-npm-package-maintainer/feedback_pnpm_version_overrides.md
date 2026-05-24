---
name: pnpm-version-reads-overrides
description: pnpm config (overrides/ignoredOptionalDependencies/build-scripts) lives in pnpm-workspace.yaml, NOT package.json — works on pnpm 10 AND 11
metadata:
  type: feedback
---

This repo keeps ALL pnpm settings (`overrides`, `ignoredOptionalDependencies`, build-script approval) in **`pnpm-workspace.yaml`**, NOT in a `pnpm` block in `package.json`. There is one `pnpm-workspace.yaml` at repo root (for `create-nuxt-base`'s standard-version overrides) and one in `nuxt-base-template/` (the 32 security overrides + 30 ignoredOptionalDependencies + build scripts). Neither has a `packages:` field — they are settings-only files for single-package projects.

**Why:** Decided 2026-05-24 (migrated from the old package.json approach). The machine's default pnpm is 11.1.3, and pnpm 11 **silently ignores `pnpm.*` keys in package.json** — it warns "The pnpm field in package.json is no longer read" and drops `overrides`, `ignoredOptionalDependencies`, and build settings. Proven regression: re-resolving the template lockfile under pnpm 11 with overrides only in package.json dropped the entire `overrides:` block and `pnpm audit` went from 0 to **4 vulnerabilities** (1 moderate, 3 high: minimatch, unhead, etc.). After moving to `pnpm-workspace.yaml`, a fresh pnpm 11 resolve re-applies all 32 overrides and audit = 0. `pnpm-workspace.yaml` is read by pnpm 10 AND 11.

**How to apply:**
- Edit overrides in `nuxt-base-template/pnpm-workspace.yaml` (and root `pnpm-workspace.yaml` for standard-version deps). NEVER re-add a `pnpm` block to package.json.
- Override TARGETS (right side) must stay fixed versions — see [[override-safety-rule]] and [[postcss-override-breadth]].
- **Build scripts:** pnpm 11 renamed `onlyBuiltDependencies` → `allowBuilds` (a `pkg: true` map). The yaml carries BOTH keys (allowBuilds for v11, onlyBuiltDependencies for v10); each version ignores the unknown one. If pnpm writes an `allowBuilds:` block with placeholder text "set this to true or false", replace those with `true`.
- **Install quirks under pnpm 11:** switching from a pnpm-10 node_modules triggers `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` — pass `--config.confirmModulesPurge=false` (do NOT use `CI=true`, which forces frozen-lockfile). After pinning specifiers (e.g. oxfmt/oxlint), use `--no-frozen-lockfile` once to update the lock.

**Toolchain access:** node/pnpm are NOT on the default PATH. Prepend `/Users/kaihaase/.local/share/fnm/node-versions/v24.12.0/installation/bin:/opt/homebrew/bin` to PATH; that dir holds node 24.12.0 and the default pnpm 11.1.3. Set `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`. (corepack pnpm@10 is no longer needed for this repo.)
