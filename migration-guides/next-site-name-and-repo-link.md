# Migration Guide: the project's name and repository link in one file

A project made with `lt fullstack init` or `lt frontend nuxt` showed "Nuxt Base Starter" in its
browser tab and header, and linked to the starter's repository from header and start page. The
footer's GitHub button pointed at `#`. The template now keeps the name and the link in
`app/utils/site.ts`, and every spot reads them from there:

```ts
export const SITE_NAME = 'Nuxt Base Starter';

/** The project's source repository; `null` hides every GitHub link. */
export const SITE_REPO_URL: null | string = 'https://github.com/lenneTech/nuxt-base-starter';
```

The lt CLI sets `SITE_NAME` to the project name and `SITE_REPO_URL` to `null` when it creates a
project. Projects made before still carry the starter's name and link, unless someone changed them
by hand.

| Project                                                                   | What to do   |
| ------------------------------------------------------------------------- | ------------ |
| Still shows "Nuxt Base Starter" or links to `lenneTech/nuxt-base-starter` | Steps 1 to 3 |
| Header and start page still the starter's, and you want the tests         | Steps 1 to 4 |
| Renamed itself and removed the links already                              | Nothing      |

No dependency and no API change are needed.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. Add `app/utils/site.ts`

Create the file with your project's name, and with your repository or `null`:

```ts
export const SITE_NAME = 'My Project';

/** The project's source repository; `null` hides every GitHub link. */
export const SITE_REPO_URL: null | string = null;
```

### 2. Take the name in `nuxt.config.ts`

```ts
import { SITE_NAME } from './app/utils/site';
```

and use it for `app.head.title` and `site.name` instead of `'Nuxt Base Starter'`:

```ts
app: { head: { title: SITE_NAME } },
site: { name: SITE_NAME },
```

`site.name` is what app.vue's title template appends to every page title and what the header names
its home link after (`:title="siteConfig.name"`).

### 3. Bind the GitHub buttons to the link

In `app/layouts/default.vue`:

```ts
import { SITE_REPO_URL } from '~/utils/site';

const githubUrl = SITE_REPO_URL;
```

and in the template, the header's tooltip and the footer's GitHub button:

```vue
<UTooltip v-if="githubUrl" text="Open on GitHub" :kbds="['meta', 'G']">
<UButton v-if="githubUrl" icon="i-simple-icons-github" color="neutral" variant="ghost" :to="githubUrl" target="_blank" aria-label="GitHub" />
```

In `app/pages/index.vue`, import `SITE_REPO_URL` the same way, set `links.github` to it and show the
"View on GitHub" button with `v-if="links.github"`.

`app/utils/app-origin.ts` names the starter's repository in a comment. Replace
`` @see https://github.com/lenneTech/nuxt-base-starter — `NUXT_PUBLIC_SITE_URL` in `.env.example` ``
with `` @see `NUXT_PUBLIC_SITE_URL` in `.env.example` ``. To find every other mention:

```bash
grep -rn "github.com/lenneTech/nuxt-base-starter" app nuxt.config.ts --exclude-dir=core
```

### 4. Take over the tests (optional)

- `tests/unit/site-contract.test.ts` checks that `site.ts` keeps both lines in the form the CLI
  rewrites, and that no other file under `app/` (the vendored `app/core/` aside) or
  `nuxt.config.ts` names the starter's repository. A link to it you keep on purpose elsewhere fails
  this check; move it into `site.ts` or drop it.
- `tests/unit/site-repo-link.test.ts` renders `default.vue` and `index.vue` with and without a
  repository. It expects the starter's layout and start page: two GitHub links in the layout, one on
  the start page. A project whose layout or start page differs adapts those numbers or leaves the
  file out.
- `tests/e2e/site-identity.spec.ts` checks the title and the links in the running app; it expects
  three links to the repository on the start page while `SITE_REPO_URL` is set, with the same
  caveat. Vendor mode: change its import `from '@lenne.tech/nuxt-extensions/testing'` to
  `from '../../app/core/runtime/testing'`.

```bash
pnpm exec vitest run tests/unit/site-contract.test.ts tests/unit/site-repo-link.test.ts
pnpm exec playwright test tests/e2e/site-identity.spec.ts
```

## Check it

Open the start page: the tab and the header show your project's name, and with `SITE_REPO_URL`
set to `null` there is no GitHub button in header, start page or footer.
