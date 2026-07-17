---
name: pnpm11-auto-minimum-release-age-exclude
description: pnpm 11 auto-excludes fresh versions from the release-age gate, but repo policy is to WAIT it out and pick an older version — plus how to escape the stale-lock deadlock
metadata:
  type: feedback
---

When running `pnpm add -E pkg@version` in `nuxt-base-template/`, pnpm 11 auto-appends entries to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` for every package published inside the gate window (default 1 day) — including ALL same-version transitives, not just the direct dep. Output: `Added N entries to minimumReleaseAgeExclude ... (loose mode allowed these immature versions)`.

**Do NOT keep those auto-added entries** (this supersedes the older "leave them in place for the run" advice). The workspace file's own policy states: *"Do NOT add third-party packages here as a habit ... Prefer simply waiting out the ~1-day gate."* The `@lenne.tech/*` glob is the only standing exemption. Pick the newest version already PAST the gate instead.

**How to apply:**
- BEFORE bumping, check age: `pnpm view <pkg> time --json`; anything <24h old will be gated. Choose the highest gate-passing version. On 2026-07-16: `vue` 3.5.40 was 7h old → used 3.5.39; `@nuxt/ui` 4.10.0 was 3h → used 4.9.0; `@pinia/nuxt` 1.0.1 was 1h → used 1.0.0. Report the deferred ones rather than exempting them.
- Then strip any entries pnpm auto-wrote, leaving only `- '@lenne.tech/*'`.

**The deadlock (important):** once a fresh version is IN the lockfile, removing the excludes makes every later command fail with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` — pnpm verifies the lockfile *before* resolving, so it will never re-resolve the offending entries away. `pnpm update pkg@older` just says "Already up to date", because transitives requested via `^3.5.x` legitimately satisfy at the fresh version. Escape that works (used 2026-07-16 to purge vue 3.5.40 → 3.5.39):
1. Temporarily re-add the auto-excludes so lockfile verification passes.
2. Add TEMPORARY exact `overrides:` for the package **and its whole sub-family** (`vue` + every `@vue/*`) pinned to the wanted older version — overrides are the only thing that forces transitive re-resolution.
3. `pnpm install` → fresh version purged; confirm `grep -c "<fresh-version>" pnpm-lock.yaml` = 0.
4. Remove BOTH the temp overrides and temp excludes, `pnpm install` again. Resolution is sticky so it stays on the older version, and the gate is fully active again.

Never use `--trust-lockfile` / `trustLockfile` to escape this — it skips verification and KEEPS the immature version, the opposite of the policy's intent.
