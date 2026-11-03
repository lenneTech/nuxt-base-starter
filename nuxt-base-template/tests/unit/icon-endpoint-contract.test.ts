import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The browser loads icons from the app's own endpoint, never from api.iconify.design.
 *
 * `icon.localApiEndpoint: '/_nuxt_icon'` in nuxt.config.ts is what keeps a signed-in user's
 * browser off Iconify's public API: every icon outside the client bundle (one from
 * `app.config.ts`, a runtime name like `i-lucide-${key}`) is fetched from the first resource of
 * the Iconify API provider. @nuxt/icon puts the app's endpoint there in the browser only while
 * the provider still holds Iconify's default, and it recognises the default by comparing with its
 * own copy of it. @iconify/vue 5.0.5 made the default two hosts, @nuxt/icon 2.6.2 still compares
 * with one, so the endpoint is never installed (nuxt/icon#571). Nothing looks broken: the public
 * API answers and the icons render. The only trace is a request to a third-party host on the
 * first client-side navigation after sign-in.
 *
 * `pnpm-workspace.yaml` holds @iconify/vue at 5.0.4 until @nuxt/icon handles the new default.
 * This test runs the code the two installed packages ship, so it goes red when they drift apart
 * again, and stays green on a release that makes the override unnecessary.
 */

const LOCAL_ENDPOINT = '/_nuxt_icon';

interface IconifyVue {
  _api: { getAPIConfig(provider: string): { resources: string[] } | undefined };
  addAPIProvider(provider: string, config: { resources: string[] }): boolean;
  setCustomIconsLoader: unknown;
}

interface NuxtIconConfig {
  applyIconifyConfig(iconify: IconifyVue): void;
  setIconifyConfig(config: { customCollections: string[]; customIconsLoader: () => null; fetch: typeof fetch; resources: string[] }): void;
}

/** @nuxt/icon comes with @nuxt/ui rather than as a direct dependency, so it is resolved from there. */
const iconDir = realpathSync(join(dirname(realpathSync('node_modules/@nuxt/ui')), 'icon'));
const iconifyVueEntry = join(dirname(createRequire(join(iconDir, 'package.json')).resolve('@iconify/vue')), 'iconify.mjs');

function appConfig(): Parameters<NuxtIconConfig['setIconifyConfig']>[0] {
  return { customCollections: [], customIconsLoader: () => null, fetch: globalThis.fetch, resources: [LOCAL_ENDPOINT] };
}

describe('icon endpoint (nuxt/icon#571)', () => {
  it("installs the app's own endpoint for the Iconify provider in the browser", async () => {
    const iconify = (await import(pathToFileURL(iconifyVueEntry).href)) as IconifyVue;
    const nuxtIcon = (await import(pathToFileURL(join(iconDir, 'dist/runtime/iconify-config.js')).href)) as NuxtIconConfig;

    // What components/shared.js does before the first icon renders in the browser.
    nuxtIcon.setIconifyConfig(appConfig());
    nuxtIcon.applyIconifyConfig(iconify);
    expect(iconify._api.getAPIConfig('')?.resources, 'icons outside the bundle would come from api.iconify.design').toEqual([LOCAL_ENDPOINT]);

    // Control: the browser branch ran. On the server @nuxt/icon replaces any provider, in the
    // browser it keeps one the app set itself. Evaluated as server code, the assertion above
    // would pass whatever the versions are.
    iconify.addAPIProvider('', { resources: ['https://icons.example.test'] });
    nuxtIcon.setIconifyConfig(appConfig());
    nuxtIcon.applyIconifyConfig(iconify);
    expect(iconify._api.getAPIConfig('')?.resources).toEqual(['https://icons.example.test']);
  });
});
