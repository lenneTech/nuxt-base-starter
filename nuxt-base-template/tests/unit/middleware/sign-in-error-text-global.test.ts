/**
 * app/middleware/sign-in-error-text.global.ts: the provider's error text never reaches the login page.
 *
 * Better Auth sends a failed sign-in through a social provider back to `/auth/login` with
 * `error_description`, where Microsoft writes a long text with trace and correlation ids. The
 * middleware redirects to the same route without that one parameter before the page renders (302 on
 * the server, `replace` on the client), so the text is neither in the HTML and the SSR payload nor in
 * the address bar and the history. `error`, `redirect` and everything else stay.
 *
 * There is no Nuxt environment in this suite, so the auto-imports the middleware uses are globals,
 * as in `ai-global.test.ts`. The served HTML is checked by `tests/e2e/auth-social-sign-in.spec.ts`.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { withoutProviderErrorText } from '../../../app/utils/social-sign-in';

interface Location {
  hash: string;
  path: string;
  query: Record<string, unknown>;
}

type Middleware = (to: Location) => unknown;

const DESCRIPTION = 'AADSTS50058: A silent sign-in request was sent but no user is signed in. Trace ID: 0f1e2d3c';

async function loadMiddleware() {
  const navigateTo = vi.fn((target: unknown, options: unknown) => ({ options, redirectedTo: target }));
  vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: Middleware) => middleware);
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('withoutProviderErrorText', withoutProviderErrorText);
  vi.resetModules();
  const middleware = (await import('../../../app/middleware/sign-in-error-text.global')).default as unknown as Middleware;
  const visit = (path: string, query: Record<string, unknown>, hash = '') => middleware({ hash, path, query });
  return { navigateTo, visit };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sign-in-error-text.global middleware', () => {
  it('redirects the login page without error_description, keeping error, redirect and the rest', async () => {
    const { navigateTo, visit } = await loadMiddleware();

    visit('/auth/login', { error: 'login_required', error_description: DESCRIPTION, redirect: '/app/x', tab: '2' }, '#top');

    expect(navigateTo).toHaveBeenCalledWith(
      { hash: '#top', path: '/auth/login', query: { error: 'login_required', redirect: '/app/x', tab: '2' } },
      { redirectCode: 302, replace: true },
    );
  });

  it('also removes a description that came without a code', async () => {
    const { navigateTo, visit } = await loadMiddleware();

    visit('/auth/login', { error_description: DESCRIPTION });

    expect(navigateTo).toHaveBeenCalledWith({ hash: '', path: '/auth/login', query: {} }, { redirectCode: 302, replace: true });
  });

  it('lets the cleaned URL through, so the redirect cannot loop', async () => {
    const { navigateTo, visit } = await loadMiddleware();

    expect(visit('/auth/login', { error: 'login_required', redirect: '/app/x' })).toBeUndefined();
    expect(visit('/auth/login', {})).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('leaves every other route alone', async () => {
    const { navigateTo, visit } = await loadMiddleware();

    expect(visit('/auth/register', { error_description: DESCRIPTION })).toBeUndefined();
    expect(visit('/app', { error_description: DESCRIPTION })).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('runs after guest.global, so a signed-in visitor still goes straight to the deep link', () => {
    // Nuxt runs global middleware in file-name order.
    const globals = readdirSync(join(import.meta.dirname, '..', '..', '..', 'app', 'middleware'))
      .filter((file) => file.endsWith('.global.ts'))
      .sort();

    expect(globals.indexOf('guest.global.ts')).toBeGreaterThan(-1);
    expect(globals.indexOf('sign-in-error-text.global.ts')).toBeGreaterThan(globals.indexOf('guest.global.ts'));
  });
});
