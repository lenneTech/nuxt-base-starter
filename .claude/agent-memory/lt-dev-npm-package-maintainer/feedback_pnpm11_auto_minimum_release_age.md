---
name: pnpm11-auto-minimum-release-age-exclude
description: pnpm 11 auto-appends to minimumReleaseAgeExclude when adding fresh versions; expect noisy diffs and clean up transitives
metadata:
  type: feedback
---

When running `pnpm add -E pkg@version` in `nuxt-base-template/`, pnpm 11.1.3 auto-appends entries to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` for every package whose release age is below the "minimumReleaseAge" threshold. This includes ALL same-version transitives — not just the direct dep being bumped.

**Why:** Observed 2026-05-31 during a routine patch bump (`better-auth 1.6.11 → 1.6.13`). pnpm added NINE entries (`@better-auth/core@1.6.13`, `@better-auth/drizzle-adapter@1.6.13`, `@better-auth/kysely-adapter@1.6.13`, `@better-auth/memory-adapter@1.6.13`, `@better-auth/mongo-adapter@1.6.13`, `@better-auth/passkey@1.6.13`, `@better-auth/prisma-adapter@1.6.13`, `@better-auth/telemetry@1.6.13`, `better-auth@1.6.13`) for a single user-facing 2-patch bump. Similar happens for any same-day npm release. Output line: `Added N entries to minimumReleaseAgeExclude in pnpm-workspace.yaml (loose mode allowed these immature versions)`.

**How to apply:**
- This is expected pnpm 11 behavior, not a bug — leave the entries in place for the duration of the maintenance run so install stays reproducible.
- Stale exclude entries from PREVIOUS sessions (e.g. `@lenne.tech/nuxt-extensions@1.7.1`) should be reviewed during cleanup — if the targeted version is now past the minimumReleaseAge window (default 7 days), the entry is dead weight and can be pruned. Don't prune entries added during the CURRENT run.
- The auto-added entries do NOT need to be reflected in CLAUDE.md's override table — that table is for `overrides:` only, not `minimumReleaseAgeExclude:`.
- Don't try to disable the auto-add behavior; it's the "loose mode" safety valve that lets pnpm proceed when a fresh release would otherwise be blocked by the age policy.
