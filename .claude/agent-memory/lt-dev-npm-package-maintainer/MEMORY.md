# lt-dev-npm-package-maintainer Memory

- [Override Safety Rule](feedback_override_safety.md) — All pnpm.overrides targets MUST use fixed versions (no `>=`, `^`, `~`)
- [Override necessity test](feedback_override_necessity_test.md) — Only a FRESH resolve (no lockfile!) + audit proves an override is still needed; template 32→3, root 4→0
- [Postcss override breadth](feedback_postcss_override_breadth.md) — OBSOLETE (override removed); kept as the example of how a stale override manufactures peer conflicts
- [pnpm config in pnpm-workspace.yaml](feedback_pnpm_version_overrides.md) — Overrides/settings live in pnpm-workspace.yaml (works pnpm 10 AND 11); pnpm 11 ignores package.json pnpm block. Default pnpm now 11.1.3 via fnm bin.
- [workspace.yaml embedding risk](project_workspace_yaml_embedding_risk.md) — lt CLI hoist reads package.json#pnpm, NOT projects/app/pnpm-workspace.yaml → overrides lost in lt-monorepo; needs CLI fix
- [vue phantom dep](feedback_vue_phantom_dep.md) — Keep vue as explicit template devDep; pnpm 11 strict hoisting breaks unit-test mock's bare vue import otherwise
- [oxfmt/oxlint latest pin](feedback_oxfmt_oxlint_latest_pin.md) — oxfmt/oxlint now pinned exactly (0.28.0/1.43.0); do NOT bump — newer versions reformat docs and break the gate
- [Project Structure](project_structure.md) — Two-level package.json structure: root (create-nuxt-base) + nuxt-base-template/; npm-mode peer contract
- [CHANGELOG .prettierignore](project_changelog_format.md) — Root CHANGELOG.md is generated; excluded from oxfmt via .prettierignore
- [pnpm 11 auto-exclude](feedback_pnpm11_auto_minimum_release_age.md) — Do NOT keep pnpm's auto-added third-party excludes; pick a gate-passing version. Includes the stale-lock deadlock escape.
