# NPM Package Maintainer Memory — nuxt-base-starter

## Topology & conventions

- [Repo topology](reference-repo-topology.md) — two independent pnpm projects (root scaffolder + `nuxt-base-template/`), separate lockfiles, settings in `pnpm-workspace.yaml`
- [Coupled version artifacts](project-coupled-version-artifacts.md) — `.nuxtrc` (@nuxt/test-utils), the vue-tsc/TS pair in the `tsconfig.tests.json` comment; Playwright image lives in lt-monorepo
- A second, older memory dir exists at the repo root (`/.claude/agent-memory/lt-dev-npm-package-maintainer/`): oxfmt `--disable-nested-config`, check auto-fix traps, corepack notes

## Version policy

- [Blocked updates](project-blocked-updates.md) — TS 7, @vueuse/nuxt 15, pnpm 12 (re-measured 2026-10-24); Playwright is a cross-repo lock-step with lt-monorepo
- [better-auth tracks nest-server](project-better-auth-tracks-nest-server.md) — client-only here; pin the version the two frameworks agree on, never npm latest
- [nuxt 4.6 Node floor](project-nuxt-46-node-floor.md) — nuxt needs Node ^24.15; dev machine is 24.12 (silent), Docker 24.18 / CI fine
- [minimumReleaseAge gate](feedback-minimum-release-age-gate.md) — skip sub-24h releases, never add a third-party exclude

## Overrides & advisories

- [Remove proven-inert overrides](feedback-remove-proven-inert-overrides.md) — fresh-resolve proof → remove in the run; Kai's policy is the decision (brace-expansion, unhead 2026-10-07)
- [Re-check suppressions on every bump](project-image-size-suppression-dead.md) — a delete-condition tied to an upstream release can never fire; prefer "package no longer resolves"