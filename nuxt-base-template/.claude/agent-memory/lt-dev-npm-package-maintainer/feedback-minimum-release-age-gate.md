---
name: feedback-minimum-release-age-gate
description: skip versions younger than the 24h minimumReleaseAge gate instead of adding a minimumReleaseAgeExclude
metadata:
  type: feedback
---

When a package's newest release is under ~24h old, take the newest release that is
OLDER than the gate and leave the fresh one for the next run. Do not add a
third-party entry to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

**Why:** the exclude list is only meant for the first-party `@lenne.tech/*` glob. A
third-party entry is dead weight the moment that version ages past the gate, and this
is a template — dead config propagates into every scaffolded project.

**How to apply:** before choosing a target version, check its publish time
(`https://registry.npmjs.org/<pkg>` → `time[version]`). Seen 2026-08-22:
`@iconify-json/lucide@1.2.125` (3.7h) and `vue-tsc@3.3.11` (21.9h) were both skipped
in favour of 1.2.124 / 3.3.10. Related: [[reference-repo-topology]].