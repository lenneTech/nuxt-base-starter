# NPM Package Maintainer Memory — nuxt-base-starter

## Topology & conventions

- [Repo topology](reference-repo-topology.md) — two independent pnpm projects (root scaffolder + `nuxt-base-template/`), separate lockfiles, settings in `pnpm-workspace.yaml`
- [Coupled version artifacts](project-coupled-version-artifacts.md) — `.nuxtrc` pins the `@nuxt/test-utils` version; no Playwright CI image in this repo

## Version policy

- [better-auth tracks nest-server](project-better-auth-tracks-nest-server.md) — client-only here; follow nest-server's exact pin, not npm latest
- [better-auth 1.7.x blocked](project-better-auth-17-blocked.md) — protocol + account-schema break; the redirect risk is in `ctx.baseURL`, not the route files
- [Blocked updates](project-blocked-updates.md) — typescript 7 held by nuxt's exact pin; plausible 3→4 already cleared as safe
- [minimumReleaseAge gate](feedback-minimum-release-age-gate.md) — skip sub-24h releases, never add a third-party exclude

## Overrides & advisories

- [Re-check suppressions on every bump](project-image-size-suppression-dead.md) — the image-size entries were removed 2026-08-22; audit is clean unsuppressed. A delete-condition tied to an upstream release can never fire