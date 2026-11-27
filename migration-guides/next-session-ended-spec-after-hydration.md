# Migration Guide: next — `auth-session-ended.spec.ts` checks the redirect target, not its spelling

A fix to one E2E spec. The app does not change.

**The last step of `tests/e2e/auth-session-ended.spec.ts` lost a race against the hydration.** The 401
interceptor sends the browser to `/auth/login?redirect=%2Fapp`, as it should. Once the login page has
hydrated, vue-router writes the address in its own spelling, which leaves `/` unencoded
(`encodeQueryValue` builds on `encodeURI`), and the address bar shows `?redirect=/app`. Both name the same
target. The spec compared the URL with the exact string `…?redirect=%2Fapp`, so it passed only when
Playwright's poll ran before the hydration. On a fast machine it did. In the GitLab CI of a project
generated from 4.0.8 it failed in 3 of 3 runs (`Expected: …?redirect=%2Fapp`, `Received: …?redirect=/app`).

The spec now parses the URL and compares origin, path and the decoded `redirect` value, which is `/app`
in both spellings.

| Project                                                                                                     | What to do |
| ----------------------------------------------------------------------------------------------------------- | ---------- |
| Has `tests/e2e/auth-session-ended.spec.ts` (generated from 4.0.7 or 4.0.8, or copied after the 4.0.7 guide) | Step 1     |
| Does not have it                                                                                            | nothing    |

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. The last assertion of the spec

In the step "the next protected request leads to the login, with the way back", replace

```ts
await expect(page).toHaveURL(`${FRONTEND_BASE}/auth/login?redirect=%2Fapp`, { timeout: 15000 });
```

with

```ts
await expect(page).toHaveURL((url) => url.origin === new URL(FRONTEND_BASE).origin && url.pathname === '/auth/login' && url.searchParams.get('redirect') === '/app', {
  timeout: 15000,
});
```

Or take over the starter's file. In vendor mode keep your import from `'../../app/core/runtime/testing'`.

The starter pins `@playwright/test` 1.65.1, whose `toHaveURL` takes the predicate. On an older Playwright,
`pnpm run typecheck:tests` tells you if yours does not.

## Check it

```bash
pnpm run typecheck:tests
pnpm exec playwright test tests/e2e/auth-session-ended.spec.ts --repeat-each=3
```

The second command needs a running API, as the rest of the auth specs do (`docs/e2e-auth.md`). Against
an API without JWT, add `E2E_SESSION_CASE=no-jwt`.
