/**
 * The App's own build identity — the counterpart to the API's `GET /meta`.
 *
 * Why this exists instead of just reading `runtimeConfig.public.appCommit` in
 * the browser: that value is not trustworthy in a deployed container. A
 * platform that manages Nuxt env vars may export every key it knows from the
 * runtime config, exporting the ones it has no value for as an EMPTY string,
 * which Nitro then applies over the commit baked into the image. Measured on
 * the running app container (TurboOps):
 *
 *   NUXT_PUBLIC_API_URL=https://api.…    ← configured, fine
 *   NUXT_PUBLIC_APP_COMMIT=              ← not configured → empty
 *
 * `/app/admin/system` therefore reported "unbekannt" for every build, and the
 * drift detection it exists for could never have caught a partial rollout.
 *
 * Reading it here — server side, at request time — is what makes the fallback
 * possible at all: `APP_VERSION_COMMIT` carries no `NUXT_` prefix, so no
 * platform rewrites it (the API has always reported correctly for exactly that
 * reason), but it is only visible to server code. Two further routes were
 * ruled out: patching `runtimeConfig` in a Nitro plugin throws
 * ("Cannot assign to read only property" — it is frozen in production), and
 * resolving during SSR never runs, because `/app/**` is `ssr: false`.
 */

export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  return {
    commit: resolveBuildCommit(config.public.appCommit, process.env.APP_VERSION_COMMIT),
    version: (config.public.appVersion as string) || '0.0.0',
  };
});
