/**
 * Whether a deployment outside production stays out of search engines' index.
 *
 * nuxt-site-config decides indexability by its own site environment: `indexable` when set,
 * otherwise `env === 'production'`. That environment is not the app's. Outside `nuxt dev` it is
 * Nuxt's `envName`, which is `production` for every build, and a stage changes it only through
 * `NUXT_SITE_ENV`. A dev or test stage that set `NUXT_PUBLIC_APP_ENV=develop` therefore answered
 * `X-Robots-Tag: index, follow` and served an indexable robots.txt (measured 2026-11-26 on a
 * deployed smoke-test stage), while the Angular starter's stage with `NG_PUBLIC_APP_ENV=develop`
 * answered `noindex, nofollow`.
 *
 * So the deployment environment decides, by the Angular starter's rule
 * (`src/server/seo-routes.ts`): no value or `production` is production, and every other value
 * takes the site out of the index. A stage that sets the site environment or `indexable` itself
 * keeps its own decision, under any of the four names nuxt-site-config reads at runtime
 * (`envSiteConfig` maps both prefixes).
 *
 * `server/plugins/site-indexing.ts` is the wiring.
 */

/** The variables through which a stage sets nuxt-site-config's environment or indexability itself. */
export const SITE_INDEXING_ENV_KEYS = ['NUXT_SITE_ENV', 'NUXT_PUBLIC_SITE_ENV', 'NUXT_SITE_INDEXABLE', 'NUXT_PUBLIC_SITE_INDEXABLE'] as const;

/**
 * The Angular starter's rule: no value or exactly `production` is production.
 *
 * `unknown`, because Nitro applies `NUXT_PUBLIC_*` through `destr()`.
 */
export function isProductionAppEnv(appEnv: unknown): boolean {
  return !appEnv || appEnv === 'production';
}

/**
 * True when the deployment environment takes the site out of the index: outside production, and
 * only while the stage sets neither the site environment nor `indexable`. An empty value counts as
 * unset, as nuxt-site-config skips it too.
 */
export function appEnvBlocksIndexing(appEnv: unknown, env: Record<string, string | undefined>): boolean {
  if (isProductionAppEnv(appEnv)) {
    return false;
  }
  return !SITE_INDEXING_ENV_KEYS.some((key) => !!env[key]);
}
