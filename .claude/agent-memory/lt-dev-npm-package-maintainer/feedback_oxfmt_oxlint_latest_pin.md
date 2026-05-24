---
name: oxfmt-oxlint-latest-pin-churn
description: Do not bump oxfmt/oxlint despite their 'latest' pin — newer versions reformat docs and break the format gate
metadata:
  type: feedback
---

`oxfmt` and `oxlint` are now pinned to EXACT versions: `oxfmt` 0.28.0 (root + template), `oxlint` 1.43.0 (template only; root has no oxlint). They were `"latest"` until 2026-05-24, when they were pinned exact to stop the `latest` string silently floating. Do NOT bump them to the actual latest (oxfmt 0.51.0 / oxlint 1.66.0) during maintenance — restore the exact pins if a bump sneaks in.

**Why:** Discovered 2026-05-24. oxfmt 0.51.0 changes markdown formatting rules and reformats many tracked files — CLAUDE.md, README.md, and even OTHER agents' `.claude/agent-memory/*/MEMORY.md` files (e.g. lt-dev-security-reviewer). Running `pnpm run format` with 0.51 produced ~2200 lines of churn across docs and reflowed prose. The root `check` runs `oxfmt --check` over the WHOLE repo tree (including markdown), so a version skew between root oxfmt and template oxfmt causes the gate to fail on whichever files the newer version wants reformatted.

**How to apply:** Keep oxfmt/oxlint at their lockfile-pinned baseline versions during maintenance — restore them with `corepack pnpm@10.18.0 install` from the pre-bump lockfile if you accidentally bumped. The `"latest"` string in package.json is aspirational; the known-good lockfile pin is what keeps the gate green. If oxfmt EVER touches CLAUDE.md (e.g. EOF newline), run the BASELINE oxfmt's `format` fixer once so the file is canonical for the gate's version, not a newer one.

ncu does NOT flag `latest`-pinned packages, so they won't show up as "outdated" — this is correct behavior, leave them.
