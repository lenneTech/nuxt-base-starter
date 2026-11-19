/**
 * The three route guards (auth.global, guest.global, admin.global) take the signed-in user from
 * `readAuthStateUser()` (app/utils/auth-state-user.ts), the same read as nuxt-extensions and
 * `/auth/callback`. Until starter 4.0.3 each guard parsed the cookie itself, under a name that
 * ignored `NUXT_PUBLIC_COOKIE_PREFIX` and from the first cookie of that name only.
 *
 * There is no Nuxt environment in this suite, so the auto-imports the guards use are globals.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isAdminUser } from '../../../app/utils/is-admin-user';
import { safeRedirectTarget } from '../../../app/utils/safe-redirect-target';

type Route = { fullPath: string; path: string; query: Record<string, unknown> };
type Middleware = (to: Route) => Promise<unknown>;

const GUARDS = ['auth.global', 'guest.global', 'admin.global'] as const;

async function load(guard: (typeof GUARDS)[number], user: unknown) {
  const navigateTo = vi.fn((target: unknown) => ({ redirectedTo: target }));
  vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: Middleware) => middleware);
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('readAuthStateUser', () => user);
  vi.stubGlobal('isAdminUser', isAdminUser);
  vi.stubGlobal('safeRedirectTarget', safeRedirectTarget);
  vi.resetModules();
  const middleware = (await import(`../../../app/middleware/${guard}.ts`)).default as unknown as Middleware;
  const visit = (path: string, query: Record<string, unknown> = {}) => middleware({ fullPath: path, path, query });
  return { navigateTo, visit };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth.global', () => {
  it('sends a visitor without a user to the login page, keeping the deep link', async () => {
    const { visit } = await load('auth.global', null);

    expect(await visit('/app/settings')).toEqual({ redirectedTo: { path: '/auth/login', query: { redirect: '/app/settings' } } });
  });

  it('lets a signed-in user through', async () => {
    const { navigateTo, visit } = await load('auth.global', { id: 'u1' });

    expect(await visit('/app/settings')).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('leaves /app/admin to admin.global and everything outside /app alone', async () => {
    const { navigateTo, visit } = await load('auth.global', null);

    expect(await visit('/app/admin')).toBeUndefined();
    expect(await visit('/auth/login')).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });
});

describe('guest.global', () => {
  it('sends a signed-in user from the login page to the validated deep link', async () => {
    const { visit } = await load('guest.global', { id: 'u1' });

    expect(await visit('/auth/login', { redirect: '/app/settings' })).toEqual({ redirectedTo: '/app/settings' });
    expect(await visit('/auth/login', { redirect: '//evil.example' })).toEqual({ redirectedTo: '/app' });
  });

  it('shows the login page to a visitor without a user', async () => {
    const { navigateTo, visit } = await load('guest.global', null);

    expect(await visit('/auth/login')).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });
});

describe('admin.global', () => {
  it('sends a visitor without a user to the login page', async () => {
    const { visit } = await load('admin.global', null);

    expect(await visit('/app/admin')).toEqual({ redirectedTo: { path: '/auth/login', query: { redirect: '/app/admin' } } });
  });

  it('sends a user without the admin role to /app', async () => {
    const { visit } = await load('admin.global', { id: 'u1', roles: ['user'] });

    expect(await visit('/app/admin')).toEqual({ redirectedTo: '/app' });
  });

  it('lets an admin through, in either role shape', async () => {
    for (const user of [{ roles: ['admin'] }, { role: 'admin' }]) {
      const { navigateTo, visit } = await load('admin.global', user);

      expect(await visit('/app/admin/users')).toBeUndefined();
      expect(navigateTo).not.toHaveBeenCalled();
    }
  });
});

describe('the guards read the user in one place', () => {
  it.each(GUARDS)('%s does not parse a cookie itself', (guard) => {
    const source = readFileSync(join(import.meta.dirname, '../../../app/middleware', `${guard}.ts`), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code).toContain('readAuthStateUser()');
    expect(code).not.toMatch(/document\.cookie|useCookie|lt-auth-state|cookieNames/);
  });
});
