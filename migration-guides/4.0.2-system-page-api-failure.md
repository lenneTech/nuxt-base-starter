# Migration Guide: /app/admin/system shows a failed `GET /meta` as an error

`/app/admin/system` compares the commit the App runs with the one the API reports through
`GET /meta`, to spot a partial or stale rollout. When the request failed, the API commit stayed
`unknown`, and the drift check ignores `unknown` on purpose, because a local build has no commit.
So an API outage looked exactly like a local build, with no error and no way to ask again, on the
page meant to show a broken rollout.

The page now shows an error with "Erneut versuchen":

- A retry that fails as well says so with the time, and a status line announces it. In an outage the
  answer comes back at once, and an unchanged page would read as a button that does nothing.
- A successful retry removes the error and moves the focus to the API row.
- While the API does not answer, the API row says so instead of showing "unbekannt".

| Project                                                     | What to do                |
| ----------------------------------------------------------- | ------------------------- |
| Has the starter's `useSystem.ts` and `system.vue` unchanged | Steps 1 to 3              |
| Changed them, or shows the build identity elsewhere         | Step 1, then adapt step 2 |

No dependency and no API change are needed.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. `app/composables/useSystem.ts`

Take over the file. It adds `apiMetaFailed`, which is true after a failed `GET /meta` and false after
a successful one. `fetchApiMeta()` sends no second request while one is running.

### 2. `app/pages/app/admin/system.vue`

Take over the file. If you changed the page, carry over:

- the error alert `v-if="apiMetaFailed"` (`data-testid="system-api-failed"`) with the retry button in
  its `#actions` slot, and the `sr-only` status line next to it;
- `retry()`, `retryFailedAt`, `apiFailedDescription` and `retryStatus` in the script;
- the API row's `<h3 ref="apiHeading" tabindex="-1">`, the text shown while `apiMetaFailed`, and
  `v-if="!apiMetaFailed"` on the commit badge (`data-testid="system-api-commit"`).

The retry button shows its busy state without `disabled`, so the keyboard focus stays on it. Its label
is `text-error-800 dark:text-error-300`. On hover the button's tint stacks on the alert's own, and the
theme's error step falls below 4.5:1 there. Measured on hover, the new classes give 5.5:1 in light
mode and 6.5:1 in dark mode.

### 3. Take over the tests

- `tests/unit/composables/use-system.test.ts`: the failure state, its reset and the single request.
- `tests/e2e/admin-system.spec.ts`: the page against a real API, with `GET /meta` failing in the
  browser. It gives its user the admin role in the database, which the API sees only when started
  with `PLAYWRIGHT=true` (see `docs/e2e-auth.md`). Vendor mode: change the spec's import
  `from '@lenne.tech/nuxt-extensions/testing'` to `from '../../app/core/runtime/testing'`.

```bash
pnpm exec vitest run tests/unit/composables/use-system.test.ts
pnpm exec playwright test tests/e2e/admin-system.spec.ts   # needs the API with PLAYWRIGHT=true
```

## Check it

Stop the API and open `/app/admin/system` as an admin: "API-Build nicht abrufbar" appears with
"Erneut versuchen". Start the API again and click it: the error is gone and the API commit shows.
