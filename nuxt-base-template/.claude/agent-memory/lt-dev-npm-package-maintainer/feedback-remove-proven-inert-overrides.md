---
name: feedback-remove-proven-inert-overrides
description: an override a fresh resolve proves inert is removed IN the maintenance run — do not park it as "needs a deliberate decision"
metadata:
  type: feedback
---

When a fresh resolve (scratch copy, no `pnpm-lock.yaml`, no `node_modules`) proves an override
inert — identical package set without it, or a different-but-patched tree with `pnpm audit`
still clean — remove it (entry, its comment, and any patch that existed only for it) in the
same run, and record the proof in the surviving comments and the report.

**Why:** Kai's policy (user memory `project-prefers-latest-exact-versions`, restated in the
2.31.0 maintenance brief): "as few overrides as possible; one may only stay while an audit
proves it carries; re-measure inherited 'let's keep it' pins". Runs on 2026-09-27 and
2026-10-03 had already proven the root `brace-expansion` override + `patches/minimatch@3.1.5.patch`
and the template `unhead` pin inert, yet kept them "because removal needs a deliberate
decision". That policy IS the decision; parking proven-inert entries just carries a downgrade-lock
risk forward (an exact pin falls below a parent's range the moment upstream ships a patch).

**How to apply:** run three resolves — A (full config), B (no overrides/patches/suppressions →
which advisories each entry holds back), C (A minus only the candidate) — and diff the resolved
package sets. Removed 2026-10-07: root brace-expansion (B gave 1.1.21, audit clean) and template
`unhead` (A == C). Still NEVER remove one because the audit is green WITH it — that is circular.
Related: [[project-image-size-suppression-dead]], [[project-blocked-updates]].