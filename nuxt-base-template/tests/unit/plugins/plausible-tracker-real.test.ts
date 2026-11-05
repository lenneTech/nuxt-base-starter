/**
 * `app/plugins/plausible.client.ts` against the real tracker: what leaves the page on a click.
 *
 * The tracker's `init()` always listens for clicks on elements tagged `plausible-event-name=…`, and
 * for a link it adds the full `href` as `props.url`, query and record ids included. That property
 * reaches the request only through `transformRequest`, so this runs the real package: should an update
 * add another property of its own, or send one past the hook, this has to go red.
 *
 * One file, one `init()`: the tracker can be started once per page.
 */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

vi.mock('#imports', () => ({
  defineNuxtPlugin: (plugin: unknown) => plugin,
  useHead: () => {},
  useRouter: () => ({ resolve: () => ({ matched: [{ path: '/app/orders/:id' }] }) }),
  useRuntimeConfig: () => ({ public: { plausible: { apiHost: 'https://stats.example', autoPageviews: false, enabled: false, ignoredHostnames: ['localhost'] } } }),
}));

const SECRET_HREF = 'https://app.example/app/orders/6630f1c2a9b8c7d6e5f40312?email=max%40test.com&token=s3cr3t';

const sentBodies: string[] = [];
const originalLocation = window.location;

beforeAll(async () => {
  Object.defineProperty(window, 'location', { value: new URL('https://app.example/app/orders') });
  // The tracker ignores automated browsers unless this is set.
  (window as unknown as { __plausible: boolean }).__plausible = true;
  vi.stubGlobal('fetch', async (_url: string, request: { body: string }) => {
    sentBodies.push(request.body);
    return new Response(null, { status: 202 });
  });
  const { default: plugin } = (await import('~/plugins/plausible.client')) as unknown as { default: { setup: () => unknown } };
  plugin.setup();
});

afterAll(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', { value: originalLocation });
});

function clickTagged(href: string): void {
  const link = document.createElement('a');
  link.className = 'plausible-event-name=Open+Order';
  link.href = href;
  // Keeps happy-dom from following the link. The tracker still reports a prevented click.
  link.addEventListener('click', (event) => event.preventDefault());
  document.body.append(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  link.remove();
}

it('sends the tagged link with its id masked and its query dropped', async () => {
  sentBodies.length = 0;

  clickTagged(SECRET_HREF);

  await vi.waitFor(() => expect(sentBodies.join()).toContain('Open Order'));
  const body = JSON.parse(sentBodies.find((sent) => sent.includes('Open Order')) ?? '{}') as { p?: Record<string, string> };
  expect(body.p?.url).toBe('https://app.example/app/orders/:id');
  expect(sentBodies.join()).not.toMatch(/6630f1c2|s3cr3t|max/);
});

it('sends a tagged mailto link without the address', async () => {
  sentBodies.length = 0;

  clickTagged('mailto:max@test.com');

  await vi.waitFor(() => expect(sentBodies.join()).toContain('Open Order'));
  expect(sentBodies.join()).not.toContain('max');
});
