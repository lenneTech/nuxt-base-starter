# lt-dev-npm-package-maintainer Memory

- [Override Safety Rule](feedback_override_safety.md) — All pnpm.overrides targets MUST use fixed versions (no `>=`, `^`, `~`)
- [Override necessity test](feedback_override_necessity_test.md) — Only a FRESH resolve (no lockfile!) + audit proves an override is still needed; template 32→3, root 4→0
- [Postcss override breadth](feedback_postcss_override_breadth.md) — OBSOLETE (override removed); kept as the example of how a stale override manufactures peer conflicts
- [pnpm config in pnpm-workspace.yaml](feedback_pnpm_version_overrides.md) — Overrides/settings live in pnpm-workspace.yaml (works pnpm 10 AND 11); pnpm 11 ignores package.json pnpm block. Default pnpm now 11.1.3 via fnm bin.
- [workspace.yaml embedding risk](project_workspace_yaml_embedding_risk.md) — lt CLI hoist reads package.json#pnpm, NOT projects/app/pnpm-workspace.yaml → overrides lost in lt-monorepo; needs CLI fix
- [vue phantom dep](feedback_vue_phantom_dep.md) — Keep vue as explicit template devDep; pnpm 11 strict hoisting breaks unit-test mock's bare vue import otherwise
- [oxfmt/oxlint bumps](feedback_oxfmt_oxlint_latest_pin.md) — bump to latest exact (0.70.0/1.85.0 on 2026-09-27); root needs --disable-nested-config; run check TWICE
- [Project Structure](project_structure.md) — Two-level package.json structure: root (create-nuxt-base) + nuxt-base-template/; npm-mode peer contract
- [CHANGELOG .prettierignore](project_changelog_format.md) — Root CHANGELOG.md is generated; excluded from oxfmt via .prettierignore
- [pnpm 11 auto-exclude](feedback_pnpm11_auto_minimum_release_age.md) — Do NOT keep pnpm's auto-added third-party excludes; pick a gate-passing version. Includes the stale-lock deadlock escape.
- [Deferred updates](project_deferred-updates.md) — TS 7, pnpm 12, @playwright/test (lt-monorepo image), @vueuse/nuxt 15: why held, what releases each
- [check auto-fix + stale copies](feedback_check_autofix_and_stale_copies.md) — template `check` WRITES oxfmt/oxlint fixes; @nuxt/test-utils bump needs a fresh resolve
