---
name: Postcss override left-side breadth
description: OBSOLETE as a live rule (postcss override removed 2026-07-16) — kept as the canonical example of how a stale override manufactures peer conflicts
type: feedback
---

**Status: the `postcss` override no longer exists.** It was removed 2026-07-16 along with 28 other overrides that upstream had overtaken (see [[override-necessity-fresh-resolve-test]]). Do not re-add it: with no postcss override, natural resolution is clean and `pnpm audit` reports 0.

**The general lesson it taught (still applies to ANY range-selector override):** an override whose LEFT selector is narrower than the versions actually installed creates a version SKEW, and that skew surfaces as unmet-peer warnings.

- Original form (2026-05-10): `postcss@<8.5.10: 8.5.X` only replaced postcss below 8.5.10, so other installs (e.g. via vite) stayed at what they requested natively (8.5.12). Bumping the TARGET alone was insufficient because the old LEFT selector never caught the natively-installed version. Rule at the time: when bumping a target to X, widen the LEFT to `<X`.
- How it ended (2026-07-16): the override read `postcss@<8.5.14: 8.5.14` while natural resolution had moved on to 8.5.15/8.5.19. It forced `autoprefixer`/`postcss-calc` down onto 8.5.14 while the tree installed 8.5.15 → permanent `unmet peer postcss` warning. **Deleting the override — not widening it — was the real fix**, and the warning vanished.

**How to apply:** treat a persistent unmet-peer warning on an overridden package as a signal that the override is STALE, not as something to paper over by widening the selector. Run the fresh-resolve test before either widening or removing. Mechanism to remember: a range selector rewrites consumers' PEER ranges too, which is what manufactures these phantom conflicts. See [[override-safety-rule]].
