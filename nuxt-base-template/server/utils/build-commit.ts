/**
 * Which commit this build reports — and why it needs two sources.
 *
 * The commit reaches the running app through `NUXT_PUBLIC_APP_COMMIT`, which
 * Nitro applies over `runtimeConfig.public.appCommit` on boot. That works —
 * until the deployment platform declares the variable itself.
 *
 * TurboOps sets EVERY key it knows from the Nuxt runtime config as a container
 * env var: the ones configured for the stage carry their value, all others are
 * exported as an EMPTY string. Measured on the running app container:
 *
 *   NUXT_PUBLIC_API_URL=https://api.…    ← configured, fine
 *   NUXT_PUBLIC_APP_COMMIT=              ← not configured → empty
 *   NUXT_PUBLIC_WEB_PUSH_KEY=            ← same
 *
 * An empty string is a value, so Nitro dutifully applies it over the commit
 * baked into the image and `/app/admin/system` reports "unbekannt". The drift
 * detection this whole chain exists for was therefore dead on arrival: an App
 * container left behind by a partial rollout looked exactly like a current one.
 *
 * The second source mirrors what the API already does — it carries its commit
 * in `APP_VERSION_COMMIT`, a name WITHOUT the `NUXT_` prefix, which is why the
 * platform leaves it alone and `GET /meta` has always reported correctly.
 */

/** A commit value that carries no information — treat it as absent. */
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '' || value === 'unknown';
}

/**
 * The commit to report, given what the public config holds and what the
 * platform-proof env var carries.
 *
 * The public value keeps priority on purpose: where the normal mechanism works
 * (plain `docker run`, Compose, Kubernetes), nothing about this changes.
 */
export function resolveBuildCommit(publicValue: unknown, envValue: string | undefined): string {
  if (!isBlank(publicValue)) {
    return publicValue as string;
  }
  if (!isBlank(envValue)) {
    return envValue as string;
  }
  // Local builds without CI have no commit at all. "unknown" is the documented
  // value that never triggers a drift warning.
  return 'unknown';
}
