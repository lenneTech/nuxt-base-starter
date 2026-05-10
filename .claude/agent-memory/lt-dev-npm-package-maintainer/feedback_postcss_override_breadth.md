---
name: Postcss override left-side breadth
description: When bumping a postcss override target, also widen the LEFT-side selector or peer-dependency mismatches occur
type: feedback
---

When the `postcss` override is `postcss@<8.5.10: 8.5.X`, it ONLY replaces postcss versions below 8.5.10. Other postcss installs (e.g. via vite) stay at whatever they request natively (e.g. 8.5.12). When other plugins (like cssnano's `postcss-merge-rules`) require `postcss@^8.5.13` peer, the older 8.5.12 fails the peer check.

**Why:** Discovered on 2026-05-10 in nuxt-base-starter — bumping the target alone from 8.5.12 to 8.5.14 was insufficient because the old left-side selector `<8.5.10` did not catch the natively-installed 8.5.12. Build still worked but `pnpm install` showed unmet peer warnings until the LEFT side was widened to `<8.5.14`.

**How to apply:** When bumping any postcss override target to version X, also update the LEFT side to `postcss@<X` so the override actually catches versions below the new target. Pattern: `"postcss@<8.5.14": "8.5.14"`.
