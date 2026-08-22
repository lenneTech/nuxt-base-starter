---
name: project-better-auth-tracks-nest-server
description: better-auth here is a CLIENT only; its version must track @lenne.tech/nest-server's exact pin, never npm latest
metadata:
  type: project
---

`better-auth` and `@better-auth/passkey` in `nuxt-base-template` are used **only as
clients** (`better-auth/vue`, `better-auth/client/plugins`,
`@better-auth/passkey/client` — all inside `@lenne.tech/nuxt-extensions`, nothing in
the template's own `app/` or `server/`). The better-auth **server** runs inside
`@lenne.tech/nest-server`, which pins both packages to an exact version
(11.36.0 → `better-auth 1.6.26`, `@better-auth/passkey 1.6.26`).

**Why:** the two halves speak a wire protocol (endpoint paths, response shapes,
account/session schema). Raising the client past the server's pin is a silent
protocol skew that no unit test in this repo can catch — the template has no
better-auth server to test against.

**How to apply:** on every maintenance run, resolve the target from
`npm view @lenne.tech/nest-server dependencies.better-auth`, not from `pnpm outdated`.
`pnpm outdated` will keep showing a newer "latest"; that is expected, not a backlog
item. See [[project-better-auth-17-blocked]].