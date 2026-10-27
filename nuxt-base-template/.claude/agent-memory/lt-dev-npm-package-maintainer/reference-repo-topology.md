---
name: reference-repo-topology
description: nuxt-base-starter is two independent pnpm projects, each with its own lockfile and pnpm-workspace.yaml
metadata:
  type: reference
---

`nuxt-base-starter` is NOT a monorepo and has no `projects/api` or `projects/app`.
Two independent pnpm projects, each maintained separately:

- repo root — release tooling only (`standard-version`, `oxfmt`). The former `create-nuxt-base`
  scaffolder (`index.js`, `fs-extra`, `cross-spawn`) was retired on 2026-10-26: npm had stopped at
  2.7.0 and the lt CLI (`lt frontend nuxt`, `lt fullstack init`) clones the template from GitHub.
- `nuxt-base-template/` — the actual Nuxt 4 template that gets scaffolded out

Each has its own `package.json`, `pnpm-lock.yaml` **and** `pnpm-workspace.yaml`.

`overrides`, `auditConfig.ignoreGhsas`, `allowBuilds`, `patchedDependencies` and
`minimumReleaseAgeExclude` live in `pnpm-workspace.yaml`, never in `package.json`'s
`pnpm` block — pnpm 11 silently ignores the latter. Both files carry extensive
per-entry rationale comments; treat them as the authoritative record and keep them
in sync with any change.

`oxfmt` is a devDependency of BOTH projects and must be bumped in lockstep, or
`format:check` diverges between the root gate and the template gate.

Gate: `pnpm run check` from the repo root chains into the template's own check
(audit, format, lint, unit tests, build, typecheck ×2, server-start).