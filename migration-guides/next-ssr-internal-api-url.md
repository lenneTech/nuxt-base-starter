# Migration Guide: server-rendered pages never carry the internal API address

The app reaches the API at two addresses. The browser uses `NUXT_PUBLIC_API_URL`. The app server
uses `NUXT_API_URL` during SSR, and on a cluster that is an internal name (`http://api:3000`) no
browser can resolve. `buildLtApiUrl()` returns the internal address during SSR. That is right for a
request the server sends itself, and wrong for a URL that ends up in the page. An `<img src>` built
with it points the browser at the internal host, and the image never loads. A project on the stack
lost its images in production that way.

The starter renders no file URL itself, so it had no such defect. It now has a test that catches the
defect in every page, and a rule in `CLAUDE.md`.

| Project                                              | What to do    |
| ---------------------------------------------------- | ------------- |
| Shows images, avatars or download links from the API | Steps 1 to 3  |
| Shows nothing from the API in its pages              | Steps 2 and 3 |

No dependency and no API change are needed. Step 1 is the fix; steps 2 and 3 keep it fixed.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, steps 1 and 2 happen in `projects/app/`; step 3 happens in the CI at
the repository root, which is where the E2E suite runs there.

### 1. Find URLs for the page built with `buildLtApiUrl()`

```bash
grep -rnE "buildLtApiUrl|apiUrl|NUXT_API_URL" app/ --include='*.vue' --include='*.ts' | grep -v "app/core/"
```

A hit on `public.apiUrl` is the public address and fine. Every other hit whose result goes into the
page (`src`, `srcset`, `href`, an avatar, a download link, a value in `useState` or the payload) is
the defect:

- A file: `useLtFile().getFileUrl(id)` or `getDownloadUrl(id)`. Both use the public address on the
  server too (nuxt-extensions 4.0.0).
- Any other API URL for the page: build it from `useRuntimeConfig().public.apiUrl`, never from
  `buildLtApiUrl()` or the server-only `useRuntimeConfig().apiUrl`.

A hit that only sends a request (`$fetch`, `useFetch`, `ltAuthFetch`) stays on `buildLtApiUrl()`:
there the internal address is the right one.

### 2. Take over the test

Copy `tests/e2e/ssr-internal-api-url.spec.ts`. It renders every page under `app/pages` that has no
route parameter, signed out, signed in and as admin, and fails when the HTML contains the host of
`NUXT_API_URL`. It uses `dropSession` from `tests/e2e/helpers/session.ts` and `grantAdminRole` from
`tests/e2e/helpers/auth-backend.ts`; copy those files too if yours lack them. Vendor mode: change the
spec's import `from '@lenne.tech/nuxt-extensions/testing'` to `from '../../app/core/runtime/testing'`.

### 3. Give the E2E job an internal address of its own

The test can only tell the internal address from the public one when they differ. Without that it
skips, and a skipped test leaves the pipeline green, so this step is what makes it run. The CI job
that runs the E2E suite needs:

```yaml
NUXT_PUBLIC_API_URL: http://localhost:3000
NUXT_API_URL: http://127.0.0.1:3000
```

Two names for the same API: every request still reaches it, and the HTML can be searched for
`127.0.0.1:3000`. Which file that is:

- **Frontend project on its own:** `.github/workflows/test.yml`, job `e2e-auth` (as in the
  starter). Add `NUXT_API_URL` next to `NUXT_PUBLIC_API_URL`.
- **`lt fullstack` monorepo:** the root CI, not `projects/app/.github/`, which no CI runs. In
  `.gitlab-ci.yml`, job `app:test`, and in `.github/workflows/test.yml`, job `app-test`, both
  already set `NUXT_API_URL: http://localhost:3000`. **Change** that value to
  `http://127.0.0.1:3000` rather than adding a second key. The API runs in the same job and listens
  on every address, so it answers on `127.0.0.1` too.

The job log shows whether it ran: Playwright's summary counts it as `skipped` instead of `passed`,
and the HTML report gives the reason ("NUXT_API_URL is unset or names a public host").

```bash
NUXT_API_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/e2e/ssr-internal-api-url.spec.ts
```

## Check it

On a deployed stage, fetch a page that shows images from the API and search it for the internal
host: `curl -s https://<app>/<page> | grep -c '<internal host>'` prints `0`. In the browser, the
images load on the first load as well as after a client-side navigation.
