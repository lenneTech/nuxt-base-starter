/**
 * What Plausible may see of a page URL.
 *
 * Auth links carry live secrets in the query. Left alone, the tracker reports `location.href` the
 * moment it starts, before any page can strip anything, and it repeats that URL in the `engagement`
 * event when the page is left. The first request of a reset link therefore handed a working token
 * to the analytics host, and `verify-email` added the e-mail address.
 *
 * The tracker test runs the real package, because the engagement half is its behaviour, not ours:
 * should an update stop reusing the pageview's URL, this has to go red.
 */
import { track as plausibleTrack, init } from '@plausible-analytics/tracker';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { analyticsUrl, reportPageviews } from '../../../app/utils/analytics-url';

const SECRET_URL = 'https://app.example/auth/reset-password?token=live-token&email=person%40test.com';

const originalLocation = window.location;

/** `tests/unit/setup.ts` replaces `location` with a writable plain object, so a navigation is a new value. */
function setLocation(value: unknown): void {
  Object.defineProperty(window, 'location', { value });
}

function visit(url: string): void {
  setLocation(new URL(url));
}

describe('analyticsUrl', () => {
  it.each([
    ['a reset token', '/auth/reset-password?token=live-token', '/auth/reset-password'],
    ['a verification token and an address', '/auth/verify-email?token=live-token&email=a%40test.com', '/auth/verify-email'],
    ['a sign-in deep link', '/auth/login?redirect=/app/records/42', '/auth/login'],
    ['a parameter nobody thought of', '/invite?code=live-code', '/invite'],
    ['a fragment', '/auth/reset-password#token=live-token', '/auth/reset-password'],
  ])('drops %s', (_label, path, expected) => {
    expect(analyticsUrl(`https://app.example${path}`)).toBe(`https://app.example${expected}`);
  });

  it.each([
    ['campaign parameters', '/?utm_source=mail&utm_medium=print&utm_campaign=fair&utm_term=x&utm_content=y'],
    ['the source parameters', '/?ref=partner&source=fair'],
  ])('keeps %s, which is what Plausible reports on', (_label, path) => {
    expect(new URL(analyticsUrl(`https://app.example${path}`)).searchParams.size).toBe(new URL(`https://app.example${path}`).searchParams.size);
  });

  it('keeps a campaign parameter next to a secret, and only that', () => {
    expect(analyticsUrl('https://app.example/auth/register?utm_source=mail&token=live-token')).toBe('https://app.example/auth/register?utm_source=mail');
  });

  it('leaves a plain page alone', () => {
    expect(analyticsUrl('https://app.example/app/settings')).toBe('https://app.example/app/settings');
  });
});

describe('reportPageviews', () => {
  const start = () => {
    const afterEachHooks: Array<() => void> = [];
    const report = vi.fn();
    const router = {
      afterEach: (hook: () => void) => {
        afterEachHooks.push(hook);
        return () => {};
      },
    };
    reportPageviews(report, router);
    return { navigate: () => afterEachHooks.forEach((hook) => hook()), report };
  };

  afterEach(() => {
    setLocation(originalLocation);
  });

  it('reports the first page at once, without its secrets', () => {
    visit(SECRET_URL);

    const { report } = start();

    expect(report).toHaveBeenCalledExactlyOnceWith({ url: 'https://app.example/auth/reset-password' });
  });

  it('reports a new path, like the tracker would', () => {
    visit('https://app.example/auth/login');
    const { navigate, report } = start();

    visit('https://app.example/app');
    navigate();

    expect(report).toHaveBeenLastCalledWith({ url: 'https://app.example/app' });
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('does not report a navigation that stays on the path', () => {
    visit(SECRET_URL);
    const { navigate, report } = start();

    // What `router.replace` does when the page strips its token.
    visit('https://app.example/auth/reset-password');
    navigate();

    expect(report).toHaveBeenCalledOnce();
  });

  it('reports a return from the back/forward cache, like the tracker would', () => {
    visit('https://app.example/app');
    const { report } = start();

    // happy-dom's PageTransitionEvent drops `persisted`.
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));

    expect(report).toHaveBeenCalledTimes(2);
  });
});

describe('the real tracker', () => {
  const sentBodies: string[] = [];

  beforeAll(() => {
    vi.stubGlobal('fetch', async (_url: string, request: { body: string }) => {
      sentBodies.push(request.body);
      return new Response(null, { status: 202 });
    });
    init({ autoCapturePageviews: false, captureOnLocalhost: true, domain: 'app.example', endpoint: 'https://analytics.example/api/event' });
  });

  it('reports `location.href` when left alone, which is why the page cannot be trusted to it', async () => {
    visit(SECRET_URL);
    sentBodies.length = 0;

    plausibleTrack('pageview', {});

    await vi.waitFor(() => expect(sentBodies.join()).toContain('live-token'));
  });

  it('keeps the secret out of the pageview and of the engagement event that repeats its URL', async () => {
    visit(SECRET_URL);
    plausibleTrack('pageview', { url: analyticsUrl(window.location.href) });
    sentBodies.length = 0;

    // The next pageview closes the previous one with an `engagement` event.
    plausibleTrack('pageview', { url: 'https://app.example/auth/login' });

    await vi.waitFor(() => expect(sentBodies.some((body) => body.includes('"engagement"'))).toBe(true));
    expect(sentBodies.join()).not.toContain('live-token');
    expect(sentBodies.join()).not.toContain('person');
  });
});

describe('nuxt.config.ts', () => {
  it('leaves pageviews to `reportPageviews`, because the tracker would report the token first', () => {
    const config = readFileSync(join(import.meta.dirname, '..', '..', '..', 'nuxt.config.ts'), 'utf8');
    const plausible = /^ {2}plausible: \{\n([\s\S]*?)^ {2}\},/m.exec(config)?.[1] ?? '';

    expect(plausible).toMatch(/^ {4}autoPageviews: false,$/m);
  });
});
