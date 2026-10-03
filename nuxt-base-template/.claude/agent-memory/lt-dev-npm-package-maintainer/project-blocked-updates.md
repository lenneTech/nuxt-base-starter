---
name: project-blocked-updates
description: standing list of template updates that are deliberately held back, with the condition that unblocks each
metadata:
  type: project
---

Deliberate holds in `nuxt-base-template` — re-check each condition per run, do not
re-litigate the analysis. State 2026-10-03.

- **typescript 7.x** (held at 6.0.3) — vue-tsc 3.3.12 still loads `typescript/lib/tsc`,
  which TypeScript 7's `exports` map no longer provides. NOT nuxt: nuxt 4.5.2 no longer
  pins typescript (the earlier reason, an exact `dependencies.typescript` in nuxt, is gone).
  Unblocks when a vue-tsc release supports TS 7; verify by installing both in a scratch
  copy and running `pnpm run typecheck`.
- **better-auth / @better-auth/passkey** — not a hold but a lock-step: see
  [[project-better-auth-tracks-nest-server]].

Cleared holds worth remembering (so they are not re-flagged as risky):

- better-auth 1.7.x (blocked 2026-08-22 while nest-server pinned 1.6.x) cleared once
  nest-server moved to 1.7; now 1.7.7 in lock-step.
- vitest 5 cleared 2026-10-03 together with better-auth 1.7.7, whose peer range admits
  `^5` (1.7.1 only admitted up to `^4`).
- `@nuxtjs/plausible` 3 → 4 was a **safe** major on 2026-08-22: `ModuleOptions` diff
  was documentation-only, `apiHost` (the only option `nuxt.config.ts` sets) survived,
  and `useTrackEvent` / `useTrackPageview` are unchanged. The major was the internal
  switch to `@plausible-analytics/tracker`.