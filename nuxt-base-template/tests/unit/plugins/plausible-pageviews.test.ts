/**
 * app/plugins/plausible-pageviews.client.ts: the only sender of pageviews.
 *
 * `plausible.autoPageviews` is off, so nothing else reports a page. Without this plugin a project
 * silently loses its analytics, and the tracker ignores localhost and automated browsers, so
 * neither development nor E2E would show it. Dropping the options is worse: the tracker falls back
 * to `location.href`, the token goes out again, and pageviews keep arriving.
 *
 * There is no Nuxt environment in this suite, so the auto-imports the plugin uses are globals.
 */
import { afterEach, expect, it, vi } from 'vitest';

import { reportPageviews } from '../../../app/utils/analytics-url';

const originalLocation = window.location;

async function runPlugin(nuxtApp: object): Promise<void> {
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin);
  vi.stubGlobal('reportPageviews', reportPageviews);
  vi.stubGlobal('useRouter', () => ({ afterEach: () => {} }));
  vi.resetModules();
  const { default: plugin } = await import('../../../app/plugins/plausible-pageviews.client');
  (plugin as unknown as (app: object) => void)(nuxtApp);
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', { value: originalLocation });
});

it('sends the first pageview through the tracker, without the secrets of the URL', async () => {
  Object.defineProperty(window, 'location', { value: new URL('https://app.example/auth/reset-password?token=live-token') });
  const trackPageview = vi.fn();

  await runPlugin({ $plausible: { trackPageview } });

  expect(trackPageview).toHaveBeenCalledExactlyOnceWith({ url: 'https://app.example/auth/reset-password' });
});

it('does nothing while Plausible is switched off', async () => {
  await expect(runPlugin({})).resolves.toBeUndefined();
});
