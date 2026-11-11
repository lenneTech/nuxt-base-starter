/**
 * `useSystem().fetchApiMeta()` tells a failed `GET /meta` apart from an API that reports no commit.
 *
 * /app/admin/system compares the App's commit with the API's. A failed request used to leave the API
 * commit at `unknown`, which the drift check deliberately ignores (a local build has no commit), so
 * an API outage looked exactly like a local build. `apiMetaFailed` now says the request failed, and
 * the page shows an error with a retry (tests/e2e/admin-system.spec.ts walks it in the browser).
 *
 * There is no Nuxt environment in this suite, so the auto-imports the composable uses are globals.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref, type Ref } from 'vue';

const META = { commit: 'abc1234def', environment: 'e2e', package: '@x/api', title: 'API', version: '1.2.3' };

let state: Map<string, Ref<unknown>>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state = new Map();
  fetchMock = vi.fn();
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { appCommit: 'abc1234def', appVersion: '0.0.1' } }));
  vi.stubGlobal('useState', <T>(key: string, init: () => T): Ref<T> => {
    if (!state.has(key)) state.set(key, ref(init()) as Ref<unknown>);
    return state.get(key) as Ref<T>;
  });
  vi.stubGlobal('buildLtApiUrl', (path: string) => `http://api.test${path}`);
  vi.stubGlobal('$fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function useSystemFresh() {
  const { useSystem } = await import('~/composables/useSystem');
  return useSystem();
}

describe('useSystem().fetchApiMeta', () => {
  it('reports the API build and no failure when /meta answers', async () => {
    fetchMock.mockResolvedValueOnce(META);
    const system = await useSystemFresh();

    await system.fetchApiMeta();

    expect(system.apiMeta.value).toEqual(META);
    expect(system.apiMetaFailed.value).toBe(false);
    expect(system.buildsMatch.value).toBe(true);
  });

  it('marks a failed /meta as failed instead of passing it off as an unknown commit', async () => {
    fetchMock.mockRejectedValueOnce(new Error('503'));
    const system = await useSystemFresh();

    await system.fetchApiMeta();

    expect(system.apiMeta.value).toBeNull();
    expect(system.apiMetaFailed.value).toBe(true);
  });

  it('clears the failure once a retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce(META);
    const system = await useSystemFresh();

    await system.fetchApiMeta();
    expect(system.apiMetaFailed.value).toBe(true);
    await system.fetchApiMeta();

    expect(system.apiMetaFailed.value).toBe(false);
    expect(system.apiMeta.value).toEqual(META);
  });

  it('sends one request when the retry is pressed again while it runs', async () => {
    let answer: (value: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const system = await useSystemFresh();

    const first = system.fetchApiMeta();
    const second = system.fetchApiMeta();
    answer(META);
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(system.apiMeta.value).toEqual(META);
  });
});
