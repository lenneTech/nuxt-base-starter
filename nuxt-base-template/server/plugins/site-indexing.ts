/**
 * Keep a deployment outside production out of search engines' index.
 *
 * The decision lives in `server/utils/site-indexing.ts`, where it is unit-testable. This file is
 * only the wiring.
 *
 * nuxt-site-config builds the site config per request and then calls `site-config:init`. An entry
 * pushed here with the runtime priority (0) wins over every build-time value, `env` from Nuxt's
 * `envName` included. @nuxtjs/robots reads the result per request (`getSiteIndexable`), so the
 * `X-Robots-Tag` header, the robots meta tag and robots.txt follow it. `appEnv` comes from the
 * runtime config, which Nitro fills from the container's `NUXT_PUBLIC_APP_ENV` at startup: the
 * stage's value decides, not the one the image was built with.
 */
export default defineNitroPlugin((nitroApp) => {
  // The hook hands over only the event's context, no full H3 event; the runtime config without an
  // event is the same object, with the container's NUXT_PUBLIC_* values applied.
  nitroApp.hooks.hook('site-config:init', ({ siteConfig }) => {
    if (appEnvBlocksIndexing(useRuntimeConfig().public.appEnv, process.env)) {
      siteConfig.push({ _context: 'nuxt-base-starter:app-env', _priority: 0, indexable: false });
    }
  });
});
