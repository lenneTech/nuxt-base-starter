---
name: project-better-auth-17-blocked
description: better-auth 1.7.x is blocked for this template — protocol + schema breaks vs the nest-server-hosted 1.6.x server
metadata:
  type: project
---

Do not raise `better-auth` / `@better-auth/passkey` to 1.7.x while
`@lenne.tech/nest-server` still pins 1.6.x. Verified 2026-08-22 against 1.7.1.

**Why:** 1.7.0 is a protocol/schema release, not a patch release.

- Accounts are re-keyed on `(issuer, accountId)`; an `issuer` field is required and
  upstream mandates an "account-identity backfill" migration before deploy.
- Auth origin is now resolved from the `Host` header by default; behind a proxy that
  only sets `x-forwarded-host` you must set `advanced.trustedProxyHeaders: true`.
  This changes what `ctx.baseURL` resolves to — and `redirectTo` is resolved with
  `new URL(callbackURL, ctx.baseURL)`, so it moves the redirect contract that
  `app/utils/app-origin.ts` was written against.
- `enableTwoFactor` now returns a `method` field (`"otp"` | `"totp"`) that callers
  must narrow on before reading `totpURI` — the E2E TOTP extraction depends on that
  response shape.
- Generic-OAuth callbacks moved to `/api/auth/callback/:id`; SAML ACS consolidated;
  captcha endpoint matching now needs explicit wildcards (`/sign-in/*`).

Worth knowing: the three source sites the redirect fix depends on
(`redirectCallback` in `api/routes/password.mjs`, `ctx.redirect(ctx.query.callbackURL)`
in `api/routes/email-verification.mjs`, `allowRelativePaths` in
`api/middlewares/origin-check.mjs`) are **byte-identical** in 1.7.1. The risk is not in
those files — it is in how `ctx.baseURL` is derived and in the DB schema. Diffing the
three files alone would have produced a false all-clear.

**Delete this entry** once nest-server ships a release pinning better-auth 1.7.x; then
follow its pin ([[project-better-auth-tracks-nest-server]]).