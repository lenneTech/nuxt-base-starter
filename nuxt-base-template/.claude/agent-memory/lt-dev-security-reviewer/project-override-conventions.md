---
name: project-override-conventions
description: override targets are FIXED versions in pnpm-workspace.yaml, never open >= ranges — a note claiming the opposite was wrong and has been replaced
metadata:
  type: project
---

How this template scopes and pins pnpm overrides, and how to review them:

- **Location:** all workspace-scoped pnpm settings (`overrides`, `auditConfig`,
  `allowBuilds` / `onlyBuiltDependencies`, `ignoredOptionalDependencies`,
  `minimumReleaseAgeExclude`) live in `pnpm-workspace.yaml`. **Never** in
  `package.json`'s `pnpm` block — pnpm 11 silently ignores it there, which regresses
  `pnpm audit` to several unnoticed vulnerabilities.
- **Targets are fixed versions, never ranges.** The right-hand side is an exact
  version (`'tar@<7.5.21': 7.5.22`). The left-hand side may carry a range, but that
  only scopes _which_ vulnerable versions get replaced. This is deliberate, after a
  silent major-version jump broke a deploy (TurboOps incident, April 2026).
- **Only override what this project actually resolves.** A dead override is useless
  and, inside an `lt fullstack` monorepo, a range selector can shadow the API's
  override and re-introduce a CVE. Check with
  `grep "'\?<pkg>@[0-9]" pnpm-lock.yaml`.
- **Suppression (`auditConfig.ignoreGhsas`) is the last resort**, and there is
  currently none — `pnpm audit` is clean unsuppressed. The bar for adding one is in
  `CLAUDE.md`; see also the maintainer's note on re-checking suppressions on every
  bump.

**How to apply when reviewing:** flag an override whose _target_ is a range or an
open `>=` bound — that is a convention violation here, not a style preference. Flag a
`pnpm` block in `package.json`. Do not flag a range on the left-hand _selector_; that
is correct usage.

**Why this note exists in this form:** it replaces an earlier note
(`project_dep_maintenance.md`, written 2026-04-04) that stated the exact opposite —
"overrides live in package.json" and "open-upper-bound `>=` targets are the project's
deliberate convention, do not flag them". Both became false, and it also referenced an
`h3-next` alias that no longer exists. A confidently specific note that has silently
inverted is worse than none: it would have told a reviewer to wave through precisely
the pattern this repo banned after an incident. Re-verify convention notes against the
file they describe before trusting them.