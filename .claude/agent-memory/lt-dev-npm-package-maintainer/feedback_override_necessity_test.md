---
name: override-necessity-fresh-resolve-test
description: The only valid test for "is this override still needed" is a FRESH resolve (delete lockfile) with overrides stripped, then audit — --lockfile-only alone silently keeps stale entries
metadata:
  type: feedback
---

To decide whether an override is still load-bearing, do NOT reason from the resolved versions in the lockfile — those are POST-override output and cannot tell you what natural resolution would give. Run this experiment instead, in a scratch copy:

1. `cp package.json pnpm-workspace.yaml <scratch>/` — **do NOT copy pnpm-lock.yaml**.
2. Strip the `overrides:` block from the copied `pnpm-workspace.yaml`.
3. `pnpm install --lockfile-only --ignore-scripts`
4. `pnpm audit` — whatever it reports is the set of overrides that are genuinely still required. Everything else is dead weight.
5. Add back ONLY the flagged overrides and re-run 3–4 to confirm audit = 0.

**Why:** Discovered 2026-07-16. Copying the existing lockfile into the scratch dir INVALIDATES the experiment: `pnpm install --lockfile-only` keeps any lockfile entry that still satisfies its range, so the override-forced versions (e.g. `handlebars@4.7.9`, `minimatch@3.1.5`) survive and audit falsely reports "no vulnerabilities" — making a still-needed override look dead. Tell-tale sign of a real re-resolve: transitive versions visibly move (e.g. `brace-expansion` 1.1.14 → 1.1.16) and/or the audit count changes. The template test caught this only because removing all overrides flipped audit 0 → 5; the root test initially gave a false "clean" until the lockfile was omitted.

**Result of the 2026-07-16 run:** template overrides went 32 → **3** (`minimatch@>=9.0.0 <9.0.7`, `@nuxt/ui@<4.7.2`, `esbuild@<0.28.1`), root overrides 4 → **0**, with audit 0 under a fresh no-lockfile resolve. Removing the stale ones also cleared three long-standing unmet-peer warnings (`nuxt`, `postcss`, `pinia`) that the dead overrides themselves had been CAUSING — an override's range selector rewrites consumers' PEER ranges too, so `nuxt@<4.4.7: 4.4.7` made every seo module "want" exactly 4.4.7 and conflict with the installed 4.4.8. A dead override is not a harmless no-op; it manufactures peer conflicts. See [[override-safety-rule]] and [[postcss-override-breadth]].
