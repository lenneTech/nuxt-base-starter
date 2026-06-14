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
  const appCommit = (runtimeConfig.public.appCommit as string) || 'unknown';

  const apiMeta = useState<ApiMeta | null>('system:apiMeta', () => null);
  const isLoadingMeta = useState<boolean>('system:isLoadingMeta', () => false);

  /**
   * Whether App and API run on the SAME build, judged by COMMIT SHA (not the
   * version number — those may legitimately differ per component). `unknown`
   * commits (local / un-tagged builds) never trigger the drift warning.
   */
  const buildsMatch = computed<boolean>(() => {
    const api = apiMeta.value?.commit;
    if (!api || api === 'unknown' || appCommit === 'unknown') {
      return true;
    }
    return api === appCommit;
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

  return {
    apiMeta: computed(() => apiMeta.value),
    appCommit,
    appVersion,
    buildsMatch,
    fetchApiMeta,
    isLoadingMeta: computed(() => isLoadingMeta.value),
  };
}
