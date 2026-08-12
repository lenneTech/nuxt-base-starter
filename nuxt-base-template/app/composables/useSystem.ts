/**
 * System / build identity.
 *
 * The App build is read from `runtimeConfig.public` (baked at build time, see
 * nuxt.config.ts); the API build is fetched from the public `GET /meta` endpoint
 * (@lenne.tech/nest-server meta module). Both are determined INDEPENDENTLY — the
 * App reads its own baked commit, the API reports its own — so a partial / stale
 * rollout can be detected at a glance.
 *
 * Two separate concerns, deliberately NOT conflated:
 *   1. The semantic VERSION (x.y.z) is per-component and may legitimately differ
 *      — App and API version independently, bumped only when that component
 *      changes. A differing version number is NOT an error.
 *   2. The COMMIT SHA is the drift detector: both images bake it from the same
 *      CI commit SHA, but each is read independently at runtime. Equal commit ⇒
 *      same build ⇒ coherent deployment, regardless of the version numbers.
 */

export interface ApiMeta {
  commit: string;
  environment: string;
  package: string;
  title: string;
  version: string;
}

export function useSystem() {
  const runtimeConfig = useRuntimeConfig();

  /** App build identity, frozen into the bundle at build time. */
  const appVersion = (runtimeConfig.public.appVersion as string) || '0.0.0';

  /**
   * The App commit — starts from the bundle, corrected by the server.
   *
   * `runtimeConfig.public.appCommit` alone is not trustworthy in a deployed
   * container: a platform that manages Nuxt env vars may export every key it
   * knows from the runtime config, exporting the ones it has no value for as an
   * EMPTY string, which Nitro applies over the commit baked into the image.
   * That is what happens on TurboOps, and it left this page — and with it the
   * whole drift detection — reporting "unknown" for every build.
   *
   * `fetchBuildIdentity()` asks our own Nitro route, which can read the
   * prefix-free `APP_VERSION_COMMIT` no platform rewrites. It has to be a
   * request: this page is `ssr: false`, so nothing resolves it server-side
   * during render, and Nitro's runtime config is frozen in production.
   */
  const appCommit = useState<string>('system:appCommit', () => (runtimeConfig.public.appCommit as string) || 'unknown');

  const apiMeta = useState<ApiMeta | null>('system:apiMeta', () => null);
  const isLoadingMeta = useState<boolean>('system:isLoadingMeta', () => false);

  /**
   * Whether App and API run on the SAME build, judged by COMMIT SHA (not the
   * version number — those may legitimately differ per component). `unknown`
   * commits (local / un-tagged builds) never trigger the drift warning.
   */
  const buildsMatch = computed<boolean>(() => {
    const api = apiMeta.value?.commit;
    if (!api || api === 'unknown' || appCommit.value === 'unknown') {
      return true;
    }
    return api === appCommit.value;
  });

  /** Fetch the API build identity from the public GET /meta endpoint. */
  async function fetchApiMeta(): Promise<ApiMeta | null> {
    isLoadingMeta.value = true;
    try {
      apiMeta.value = await $fetch<ApiMeta>(buildLtApiUrl('/meta'));
      return apiMeta.value;
    } catch {
      apiMeta.value = null;
      return null;
    } finally {
      isLoadingMeta.value = false;
    }
  }

  /**
   * Ask our own server what commit it is running.
   *
   * Failure is not an error worth showing: the value already holds whatever the
   * bundle carries, and a missing route (older build) simply means no
   * correction — the page then behaves exactly as it did before.
   */
  async function fetchBuildIdentity(): Promise<string> {
    try {
      const identity = await $fetch<{ commit: string }>('/api/build-identity');
      if (identity?.commit) {
        appCommit.value = identity.commit;
      }
    } catch {
      // keep the bundled value
    }
    return appCommit.value;
  }

  return {
    apiMeta: computed(() => apiMeta.value),
    appCommit,
    appVersion,
    buildsMatch,
    fetchApiMeta,
    fetchBuildIdentity,
    isLoadingMeta: computed(() => isLoadingMeta.value),
  };
}
