---
name: project-image-size-suppression-dead
description: re-check audit suppressions on every dependency bump — the image-size entries outlived their cause because their delete-condition could never fire
metadata:
  type: project
---

The template's `pnpm-workspace.yaml` used to suppress `GHSA-w3rx-r6r6-pgpr` and
`GHSA-5p2g-fcmc-qvqq` (image-size infinite loop, both HIGH). **Both were removed on
2026-08-22** — `pnpm audit` is now clean on its own merits, with nothing suppressed.
The `auditConfig.ignoreGhsas` block is gone; the file keeps a comment explaining why.

**The lesson, which is why this note survives the fix.** The entries' own documented
delete-condition was "once image-size 2.0.3 is published". That version was never
released and never will be — the dependency left the tree instead, when `@nuxtjs/seo`
5.3.14 pulled `nuxt-seo-utils` 8.4.2, which swapped `image-size` for
`buffer-image-size`. So the suppression outlived its cause by a full release cycle,
and anyone reading only the stated condition would have kept it forever.

**How to apply:** re-check every suppression on **every** dependency bump, not only
when the advisory's named fix version appears. Prefer a delete-condition you can
observe directly ("this package no longer resolves") over one that depends on an
upstream release that may never happen. The cheap proof: `pnpm why <pkg>` returns
nothing, and `grep "<pkg>@[0-9]" pnpm-lock.yaml` matches nothing — then remove the
ids and confirm `pnpm audit` stays clean.

Same class of trap as the `brace-expansion` entry documented in `CLAUDE.md`, where a
mechanically correct justification led to a wrong conclusion.