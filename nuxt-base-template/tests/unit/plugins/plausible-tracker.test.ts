/**
 * Plausible runs only with an explicitly set analytics host, and then sends nothing that names a person.
 *
 * `@nuxtjs/plausible` 4.0.0 is on by default and falls back to `https://plausible.io` without an
 * `apiHost`. The template read the host from `NUXT_PLAUSIBLE_API_URL` at build time, a variable CI
 * builds leave empty, so every generated project reported its pageviews to plausible.io, whether it
 * used Plausible or not.
 *
 * Now the module stays registered but idle (`enabled: false`, its composables still exist), and
 * `app/plugins/plausible.client.ts` starts the tracker itself, only while the runtime config carries
 * a host. That host comes from `NUXT_PLAUSIBLE_API_URL` at build time or from
 * `NUXT_PUBLIC_PLAUSIBLE_API_HOST` on the stage. Starting it ourselves frees the tracker's
 * `transformRequest`, which the module occupies: every event's URL and referrer pass the masks there.
 *
 * The first block resolves the real `nuxt.config.ts` with the real module defaults, so it fails as
 * soon as a config change lets the plausible.io fallback back in.
 */
import plausibleModule from '@nuxtjs/plausible';
import { join } from 'node:path';
import { loadNuxtConfig } from 'nuxt/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tracker = vi.hoisted(() => ({ init: vi.fn(), track: vi.fn() }));
vi.mock('@plausible-analytics/tracker', () => tracker);

const nuxt = vi.hoisted(() => ({ runtimeConfig: { public: {} as Record<string, unknown> }, useHead: vi.fn() }));
vi.mock('#imports', () => ({
  defineNuxtPlugin: (plugin: unknown) => plugin,
  useHead: nuxt.useHead,
  useRuntimeConfig: () => nuxt.runtimeConfig,
}));

type PlausibleOptions = Record<string, unknown> & { apiHost: string; enabled: boolean };
type Plugin = { setup: () => undefined | { provide: { plausible: { trackEvent: (name: string, options?: object) => void; trackPageview: (options?: object) => void } } } };
type Payload = { d: string; n: string; r: null | string; u: string };

const templateRoot = join(import.meta.dirname, '..', '..', '..');

/** What the module writes into `runtimeConfig.public.plausible` for the template's `nuxt.config.ts`. */
async function resolvedOptions(buildTimeUrl?: string): Promise<PlausibleOptions> {
  if (buildTimeUrl === undefined) {
    vi.stubEnv('NUXT_PLAUSIBLE_API_URL', undefined);
  } else {
    vi.stubEnv('NUXT_PLAUSIBLE_API_URL', buildTimeUrl);
  }
  // No dotenv: a developer's `.env` must not decide this test.
  const options = await loadNuxtConfig({ cwd: templateRoot, dotenv: false });
  const getOptions = (plausibleModule as unknown as { getOptions: (inline: object, nuxt: object) => Promise<PlausibleOptions> }).getOptions;
  return getOptions({}, { options });
}

async function loadPlugin(path: string): Promise<Plugin> {
  vi.resetModules();
  const { default: plugin } = (await import(path)) as { default: Plugin };
  return plugin;
}

const templatePlugin = (): Promise<Plugin> => loadPlugin('../../../app/plugins/plausible.client');

/** The `transformRequest` the template plugin hands the tracker. */
function transformRequest(): (payload: Payload) => null | Payload {
  const [config] = tracker.init.mock.calls[0] ?? [];
  return (config as { transformRequest: (payload: Payload) => null | Payload }).transformRequest;
}

function withHost(apiHost: unknown, more: object = {}): void {
  nuxt.runtimeConfig = { public: { plausible: { autoPageviews: false, enabled: false, ignoredHostnames: ['localhost'], ...more, apiHost } } };
}

const originalLocation = window.location;

beforeEach(() => {
  tracker.init.mockReset();
  tracker.track.mockReset();
  nuxt.useHead.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(window, 'location', { value: originalLocation });
});

describe('nuxt.config.ts with the real module defaults', () => {
  it('leaves no analytics host and no running module without an address, never plausible.io', async () => {
    const options = await resolvedOptions();

    // An empty string, not a missing key: `NUXT_PUBLIC_PLAUSIBLE_API_HOST` only lands on a key the build wrote.
    expect(options).toHaveProperty('apiHost', '');
    expect(options.enabled).toBe(false);
  });

  it('takes the address set at build time, trimmed', async () => {
    expect((await resolvedOptions('  https://stats.example  ')).apiHost).toBe('https://stats.example');
  });

  it('treats an address of blanks as none', async () => {
    expect((await resolvedOptions('   ')).apiHost).toBe('');
  });

  it('keeps the tracker from reporting pageviews itself, with or without an address', async () => {
    expect((await resolvedOptions()).autoPageviews).toBe(false);
    expect((await resolvedOptions('https://stats.example')).autoPageviews).toBe(false);
  });

  it('leaves the module idle with an address too: the template plugin starts the tracker', async () => {
    expect((await resolvedOptions('https://stats.example')).enabled).toBe(false);
  });
});

describe('app/plugins/plausible.client.ts', () => {
  it.each([
    ['no address', ''],
    ['an address of blanks', '   '],
    ['a value that is no string', true],
    ['no key at all', undefined],
  ])('starts nothing with %s', async (_label, apiHost) => {
    withHost(apiHost);

    expect((await templatePlugin()).setup()).toBeUndefined();
    expect(tracker.init).not.toHaveBeenCalled();
    expect(nuxt.useHead).not.toHaveBeenCalled();
  });

  it('starts nothing with the template config as built without an address', async () => {
    nuxt.runtimeConfig = { public: { plausible: await resolvedOptions() } };

    expect((await templatePlugin()).setup()).toBeUndefined();
    expect(tracker.init).not.toHaveBeenCalled();
  });

  it('starts the tracker for an address set on the stage, and talks only to that server', async () => {
    nuxt.runtimeConfig = { public: { plausible: { ...(await resolvedOptions()), apiHost: 'https://stats.example/' } } };

    (await templatePlugin()).setup();

    expect(tracker.init).toHaveBeenCalledOnce();
    expect(tracker.init.mock.calls[0]?.[0]).toMatchObject({ autoCapturePageviews: false, endpoint: 'https://stats.example/api/event' });
  });

  it('preconnects to that server', async () => {
    withHost('https://stats.example');

    (await templatePlugin()).setup();

    expect(nuxt.useHead).toHaveBeenCalledWith({ link: [{ href: 'https://stats.example', rel: 'preconnect' }] });
  });

  it('keeps the automatic link, download and form capture off, which reports addresses the masks do not see', async () => {
    withHost('https://stats.example', { autoOutboundTracking: true, fileDownloads: true, formSubmissions: true });

    (await templatePlugin()).setup();

    expect(tracker.init.mock.calls[0]?.[0]).toMatchObject({ fileDownloads: false, formSubmissions: false, outboundLinks: false });
  });

  it('sends every event with a masked URL and a referrer cut to its origin', async () => {
    withHost('https://stats.example');
    Object.defineProperty(window, 'location', { value: new URL('https://app.example/') });
    (await templatePlugin()).setup();

    const sent = transformRequest()({
      d: 'app.example',
      n: 'Signup',
      r: 'https://mail.example/inbox/abcdefabcdefabcdefabcdef?q=max%40test.com',
      u: 'https://app.example/share/aB3dE?email=max%40test.com&utm_source=mail',
    });

    expect(sent).toEqual({ d: 'app.example', n: 'Signup', r: 'https://mail.example', u: 'https://app.example/share/:id?utm_source=mail' });
  });

  it('drops events from a hostname the config ignores, as the module would', async () => {
    withHost('https://stats.example', { ignoredHostnames: ['localhost', 'staging.example'] });
    Object.defineProperty(window, 'location', { value: new URL('https://staging.example/') });
    (await templatePlugin()).setup();

    expect(transformRequest()({ d: 'staging.example', n: 'pageview', r: null, u: 'https://staging.example/' })).toBeNull();
  });

  it('provides `$plausible` for the module composables and `reportPageviews`', async () => {
    withHost('https://stats.example');

    const plausible = (await templatePlugin()).setup()?.provide.plausible;
    plausible?.trackPageview({ url: 'https://app.example/' });
    plausible?.trackEvent('Signup', { props: { plan: 'pro' } });

    expect(tracker.track.mock.calls).toEqual([
      ['pageview', { url: 'https://app.example/' }],
      ['Signup', { props: { plan: 'pro' } }],
    ]);
  });
});
