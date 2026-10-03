---
name: project-better-auth-tracks-nest-server
description: better-auth here is a CLIENT only; pin the exact version the two frameworks agree on (lock-step), never npm latest
metadata:
  type: project
---

`better-auth` and `@better-auth/passkey` in `nuxt-base-template` are used **only as
clients** (`better-auth/vue`, `better-auth/client/plugins`,
`@better-auth/passkey/client` — all inside `@lenne.tech/nuxt-extensions`, nothing in
the template's own `app/` or `server/`). The better-auth **server** runs inside
`@lenne.tech/nest-server`.

Since nest-server 11.41.8 / nuxt-extensions 1.18.4 (2026-10-03) both frameworks declare
the SAME peer range, `>=1.7.7 <1.8.0`, and both starters pin one exact version inside it
(1.7.7 here, in nest-server-starter too). The floor moved 1.7.1 → 1.7.7 for
GHSA-965c-763c-88jm (critical, OAuth state usable as a magic link).

**Why:** the two halves speak a wire protocol (endpoint paths, response shapes,
account/session schema). A client on a different version than the server is a silent
protocol skew that no unit test in this repo can catch; the `e2e-auth` CI job (real
nest-server-starter API) is the only layer that sees it.

**How to apply:** on every maintenance run, read the target from the frameworks, not from
`pnpm outdated`:

```bash
npm view @lenne.tech/nest-server peerDependencies.better-auth
npm view @lenne.tech/nuxt-extensions peerDependencies.better-auth
```

Both must print the same range; pin the version nest-server-starter pins. A newer
better-auth inside the range is a lock-step bump across all four repos (nest-server,
nuxt-extensions, both starters) in one release round, never a maintenance-run bump here.
`pnpm outdated` showing a newer "latest" is expected, not a backlog item.