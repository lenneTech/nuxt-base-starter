# Migration Guide: next — deployments outside production are noindex

A change to one server plugin and to how stages are configured. Production pages do not change.

**Dev and test stages stayed in search engines' index.** nuxt-site-config decides indexability by
its own site environment: `indexable` when set, otherwise `env === 'production'`. Outside
`nuxt dev` that environment is Nuxt's `envName`, which is `production` for every build, and only
`NUXT_SITE_ENV` changes it. `NUXT_PUBLIC_APP_ENV` does not reach it. A deployed dev stage with
`NUXT_PUBLIC_APP_ENV=develop` answered `X-Robots-Tag: index, follow` and served robots.txt as
`(indexable)`. The Angular starter's stage with `NG_PUBLIC_APP_ENV=develop` answered
`noindex, nofollow` (both measured 2026-11-26). `.env.example` added to the confusion: it said of
`NUXT_SITE_ENV` "Never set it in a deployment", which meant production and read as "never".

**Since this change the deployment environment decides, by the Angular starter's rule.**
`server/plugins/site-indexing.ts` pushes `indexable: false` from nuxt-site-config's
`site-config:init` hook when `NUXT_PUBLIC_APP_ENV` is anything but `production`. An unset value
counts as production. A stage that sets `NUXT_SITE_ENV`, `NUXT_SITE_INDEXABLE` or their
`NUXT_PUBLIC_` forms keeps its own decision.

Measured on a build made as in the Docker image (without `.env`), started with
`node .output/server/index.mjs`:

| Stage env                                                             | `/` `X-Robots-Tag`  | robots.txt            |
| --------------------------------------------------------------------- | ------------------- | --------------------- |
| nothing set                                                           | `index, follow, …`  | `(indexable)`         |
| `NUXT_PUBLIC_APP_ENV=production`                                      | `index, follow, …`  | `(indexable)`         |
| `NUXT_PUBLIC_APP_ENV=develop` / `test`                                | `noindex, nofollow` | `(indexing disabled)` |
| `NUXT_PUBLIC_APP_ENV=develop` + `NUXT_SITE_ENV=production`            | `index, follow, …`  | `(indexable)`         |
| `NUXT_PUBLIC_APP_ENV=develop` + `NUXT_PUBLIC_SITE_INDEXABLE=true`     | `index, follow, …`  | `(indexable)`         |
| `NUXT_PUBLIC_APP_ENV=production` + `NUXT_PUBLIC_SITE_INDEXABLE=false` | `noindex, nofollow` | `(indexing disabled)` |

`/app` stayed `noindex` in every row, as before; `/auth` and `/admin` carry the same route rule.

The deployed dev stage of the smoke-test project (image from CI, `NUXT_PUBLIC_APP_ENV=develop`, no
`NUXT_SITE_*`) answered `index, follow` before the change and `noindex, nofollow` after it, with the
same robots meta tag and `Disallow: /` in robots.txt (2026-11-26).

| Project                                                                   | What to do              |
| ------------------------------------------------------------------------- | ----------------------- |
| Deploys stages other than production                                      | Steps 1 to 3            |
| Production stage sets `NUXT_PUBLIC_APP_ENV` to something not `production` | Step 3 first            |
| Production only                                                           | Steps 1 and 2, optional |

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`. Vendor mode changes nothing
here: both files are project code under `server/`.

### 1. Check `appEnv`

The plugin reads `runtimeConfig.public.appEnv`. Nitro applies `NUXT_PUBLIC_APP_ENV` only over a key
the config declares. Without the key the value stays empty on every stage, the plugin takes that
for production and does nothing, and every check below stays green. The starter has declared it
since 2.11.0; a project generated earlier, or one that skipped that guide, may not have it. Check
that your `nuxt.config.ts` declares it with the starter's default:

```ts
const appEnv = process.env.NUXT_PUBLIC_APP_ENV || (process.env.NODE_ENV === 'development' ? 'local' : 'production');
// …
runtimeConfig: {
  public: {
    appEnv,
  },
},
```

The default matters as much as the key: a build without `NUXT_PUBLIC_APP_ENV` has to resolve to
`production`, or a production stage that sets nothing leaves the index. A project with
`tests/unit/runtime-config-contract.test.ts` and `NUXT_PUBLIC_APP_ENV` in `.env.example` already
gets a red test without the key.

### 2. The plugin

Take over from the starter:

- `server/utils/site-indexing.ts` (the decision, `appEnvBlocksIndexing()`)
- `server/plugins/site-indexing.ts` (the wiring)
- `tests/unit/server/site-indexing.test.ts`

If your project already keeps stages out of the index another way (a stage variable, a robots
config of its own), keep it. The plugin stays out of the way of `NUXT_SITE_ENV` and
`NUXT_SITE_INDEXABLE` on the stage, and a `Disallow: /` of your own still applies.

Optionally take over the comments on `NUXT_SITE_ENV` and `NUXT_PUBLIC_APP_ENV` in `.env.example`
and on `appEnv` in `nuxt.config.ts`. Of these comments, `tests/unit/lt-dev-env.test.ts` reads only
the line `NUXT_SITE_ENV=development`, which stays.

### 3. The stage variables

Check `NUXT_PUBLIC_APP_ENV` on every stage (TurboOps stage env, the lane in the deployments
register):

- **Production:** exactly `production`, or not set. Any other value (`prod`, `live`, `main`) now
  takes the site out of the index.
- **Dev, test, preview:** the stage's name, such as `develop` or `test`. A stage without the
  variable stays indexable, as before: projects created with `lt deployment create` up to now were
  not told to set it.
- **Never `local` on a deployed stage**, as before: `/auth/verify-email` then points to an API
  terminal nobody has.

A stage that already sets `NUXT_PUBLIC_SITE_INDEXABLE=false` or `NUXT_SITE_ENV` can keep it.

## Check it

```bash
pnpm run typecheck
pnpm exec vitest run tests/unit/server/site-indexing.test.ts
```

After the deploy, on each stage:

```bash
curl -sI https://<stage-host>/ | grep -i x-robots-tag   # dev/test: noindex, nofollow; production: index, follow, …
curl -s https://<stage-host>/robots.txt | head -3      # dev/test: "(indexing disabled)" and Disallow: /
```
