---
name: project-blocked-updates
description: standing list of template updates that are deliberately held back, with the condition that unblocks each
metadata:
  type: project
---

Deliberate holds in `nuxt-base-template` — re-check each condition per run, do not
re-litigate the analysis.

- **typescript 7.x** — `nuxt` pins `typescript` as an exact **dependency**
  (nuxt 4.5.2 → 6.0.3). Raising the template past it installs two TypeScript copies.
  `vue-tsc` peers `>=5.0.0` so it is not the blocker. Unblocks when nuxt bumps its own
  pin; verify with `npm view nuxt@<ver> dependencies.typescript`.
- **better-auth / @better-auth/passkey 1.7.x** — see
  [[project-better-auth-17-blocked]].

Cleared holds worth remembering (so they are not re-flagged as risky):

- `@nuxtjs/plausible` 3 → 4 was a **safe** major on 2026-08-22: `ModuleOptions` diff
  was documentation-only, `apiHost` (the only option `nuxt.config.ts` sets) survived,
  and `useTrackEvent` / `useTrackPageview` are unchanged. The major was the internal
  switch to `@plausible-analytics/tracker`.