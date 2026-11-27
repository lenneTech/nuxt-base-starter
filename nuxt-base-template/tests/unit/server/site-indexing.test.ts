/**
 * Contract test for keeping deployments outside production out of the index.
 *
 * Both failure modes are silent:
 *
 * - Too narrow: a dev or test stage answers `index, follow`, and search engines index a stage
 *   with test data next to the real site. That was the state up to this test (2026-11-26).
 * - Too broad: production answers `noindex`, and the customer's site leaves the index without an
 *   error anywhere.
 *
 * `appEnvBlocksIndexing` is the pure half; `server/plugins/site-indexing.ts` is the wiring, and
 * the last block runs it, so a plugin that inverts or drops the decision fails too.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appEnvBlocksIndexing, isProductionAppEnv, SITE_INDEXING_ENV_KEYS } from '../../../server/utils/site-indexing';

describe('isProductionAppEnv: the Angular starter rule', () => {
  it.each([undefined, null, '', 'production'])('%j is production', (appEnv) => {
    expect(isProductionAppEnv(appEnv)).toBe(true);
  });

  it.each(['develop', 'development', 'test', 'staging', 'local', 'Production', 'prod', 42])('%j is not production', (appEnv) => {
    // Exact, as in ng-base-starter: a production stage sets `production` or nothing.
    expect(isProductionAppEnv(appEnv)).toBe(false);
  });
});

describe('appEnvBlocksIndexing', () => {
  it('keeps production indexable', () => {
    expect(appEnvBlocksIndexing('production', {})).toBe(false);
  });

  it('keeps a deployment without an app env indexable', () => {
    // An image built without NUXT_PUBLIC_APP_ENV bakes `production`; the runtime value is then
    // `production` too. Unset stays as indexable as before this rule.
    expect(appEnvBlocksIndexing(undefined, {})).toBe(false);
  });

  it.each(['develop', 'development', 'test'])('takes a %s stage out of the index', (appEnv) => {
    expect(appEnvBlocksIndexing(appEnv, {})).toBe(true);
  });

  it.each(
    SITE_INDEXING_ENV_KEYS.flatMap((key) => [
      [key, 'production'],
      [key, 'true'],
      [key, 'false'],
    ]),
  )('leaves the decision to the stage when it sets %s=%s', (key, value) => {
    expect(appEnvBlocksIndexing('develop', { [key]: value })).toBe(false);
  });

  it('treats an empty stage value as unset, as nuxt-site-config does', () => {
    expect(appEnvBlocksIndexing('develop', { NUXT_SITE_ENV: '' })).toBe(true);
  });

  it('names all four variables nuxt-site-config reads for env and indexable', () => {
    // envSiteConfig strips NUXT_SITE_ or NUXT_PUBLIC_SITE_ and camel-cases the rest, so both
    // prefixes reach `env` and `indexable`.
    expect([...SITE_INDEXING_ENV_KEYS].sort()).toEqual(['NUXT_PUBLIC_SITE_ENV', 'NUXT_PUBLIC_SITE_INDEXABLE', 'NUXT_SITE_ENV', 'NUXT_SITE_INDEXABLE']);
  });
});

describe('server/plugins/site-indexing.ts', () => {
  // Runs the plugin itself instead of matching its text: a pattern on the source stayed green
  // for `!appEnvBlocksIndexing(…)`, which would take production out of the index and leave the
  // stages in it. Nitro's auto-imports are globals here, looked up when the hook runs.
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** What the plugin pushes onto the site config stack of one request. */
  async function pushedFor(appEnv: unknown, stageEnv: Partial<Record<(typeof SITE_INDEXING_ENV_KEYS)[number], string>> = {}): Promise<unknown[]> {
    // An empty value counts as unset, so this also shields the test from what the shell or CI exports.
    for (const key of SITE_INDEXING_ENV_KEYS) {
      vi.stubEnv(key, stageEnv[key] ?? '');
    }
    vi.stubGlobal('defineNitroPlugin', (setup: unknown) => setup);
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { appEnv } }));
    vi.stubGlobal('appEnvBlocksIndexing', appEnvBlocksIndexing);
    const { default: plugin } = await import('../../../server/plugins/site-indexing');
    const hooks = new Map<string, (context: { siteConfig: { push: (entry: unknown) => void } }) => void>();
    const nitroApp = { hooks: { hook: (name: string, fn: (context: { siteConfig: { push: (entry: unknown) => void } }) => void) => hooks.set(name, fn) } };
    plugin(nitroApp as unknown as Parameters<typeof plugin>[0]);
    const pushed: unknown[] = [];
    const init = hooks.get('site-config:init');
    expect(init, 'the plugin registers a site-config:init hook').toBeTypeOf('function');
    init!({ siteConfig: { push: (entry) => pushed.push(entry) } });
    return pushed;
  }

  it('pushes nothing on production', async () => {
    expect(await pushedFor('production')).toEqual([]);
    expect(await pushedFor(undefined)).toEqual([]);
  });

  it('pushes indexable: false at the runtime priority on a dev or test stage', async () => {
    expect(await pushedFor('develop')).toEqual([expect.objectContaining({ _priority: 0, indexable: false })]);
    expect(await pushedFor('test')).toEqual([expect.objectContaining({ _priority: 0, indexable: false })]);
  });

  it('pushes nothing when the stage sets the site environment itself', async () => {
    expect(await pushedFor('develop', { NUXT_SITE_ENV: 'production' })).toEqual([]);
    expect(await pushedFor('develop', { NUXT_PUBLIC_SITE_INDEXABLE: 'true' })).toEqual([]);
  });
});
