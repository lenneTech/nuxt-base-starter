---
name: project-nuxt-46-node-floor
description: nuxt 4.6.0 requires Node ^22.22.3 || ^24.15.0 || >=26; the dev machine runs 24.12.0 (silently below), Docker/CI are above
metadata:
  type: project
---

nuxt 4.6.0 (taken 2026-10-07) declares `engines.node: ^22.22.3 || ^24.15.0 || >=26.0.0`
(4.5.2 had `^24.11.0`). Where each runtime stands, measured that day:

- template `Dockerfile`: `node:24-alpine@sha256:a0b9bf06…` = **24.18.0** (looked up via the
  Docker Hub tags API) — OK.
- GitHub Actions: `node-version: '24'` → newest 24.x — OK.
- Kai's machine: fnm default **24.12.0** — BELOW the floor. The full gate still passed
  (build, typecheck x2, 535 tests, server-start), and pnpm printed NO engine warning, so
  nothing announces the mismatch.
- The template's own `engines.node` is still `>=22` — looser than nuxt's floor. Deliberately
  not tightened in the maintenance run: pnpm enforces the root project's engines, so `^24.15.0`
  would make `pnpm install` fail on the 24.12.0 dev machine.

**Why:** a later nuxt may start using a 24.15+ API; then the local gate breaks with an error
that does not mention Node, while CI stays green.

**How to apply:** if a nuxt bump fails locally only (CI/Docker green), check `node -v` against
`npm view nuxt@<ver> engines` before debugging. Raising the local Node (fnm) and the template's
`engines.node` is Kai's call, not a maintenance-run change. Related: [[project-blocked-updates]].