/**
 * app/utils/auth-state-user.ts: the user the route guards see.
 *
 * The guards read the auth-state cookie the way nuxt-extensions reads it, under the name
 * `getLtAuthCookieNames()` resolves (an explicit `cookieNames.state`, else `<prefix>-auth-state`
 * with `NUXT_PUBLIC_COOKIE_PREFIX`, else `lt-auth-state`) and, of several cookies with that name, the
 * first one that carries a user. Until starter 4.0.3 they took the configured `cookieNames.state`
 * or `lt-auth-state` and the first cookie of that name. With a prefix set, the library wrote one
 * cookie and the guards read another; with a user-less twin in front, they sent a signed-in user to
 * the login page, where `/auth/callback` (which reads through the library) had just let them in.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAuthStateUser, userFromAuthStateCookies } from '../../../app/utils/auth-state-user';

const USER = { id: 'u1', roles: ['admin'] };

function entry(name: string, state: unknown): string {
  return `${name}=${encodeURIComponent(JSON.stringify(state))}`;
}

describe('userFromAuthStateCookies', () => {
  it('returns the user of the cookie with the given name', () => {
    expect(userFromAuthStateCookies(entry('lt-auth-state', { authMode: 'cookie', user: USER }), 'lt-auth-state')).toEqual(USER);
  });

  it('prefers a twin that carries a user over an earlier user-less one', () => {
    const header = [entry('lt-auth-state', { authMode: 'cookie', user: null }), entry('lt-auth-state', { authMode: 'cookie', user: USER })].join('; ');

    expect(userFromAuthStateCookies(header, 'lt-auth-state')).toEqual(USER);
  });

  it('ignores a cookie under another name: the prefixed name does not read lt-auth-state', () => {
    const header = [entry('lt-auth-state', { user: USER }), entry('my-app-auth-state', { user: null })].join('; ');

    expect(userFromAuthStateCookies(header, 'my-app-auth-state')).toBeNull();
    expect(userFromAuthStateCookies(header, 'lt-auth-state')).toEqual(USER);
  });

  it('does not match a name that only starts with the configured one', () => {
    expect(userFromAuthStateCookies(entry('lt-auth-state-old', { user: USER }), 'lt-auth-state')).toBeNull();
  });

  it('skips a malformed twin and keeps looking', () => {
    const header = ['lt-auth-state=%7Bbroken', entry('lt-auth-state', { user: USER })].join('; ');

    expect(userFromAuthStateCookies(header, 'lt-auth-state')).toEqual(USER);
  });

  it('returns null without a cookie, without a user, and for an empty header', () => {
    expect(userFromAuthStateCookies(entry('lt-auth-state', { authMode: 'cookie', user: null }), 'lt-auth-state')).toBeNull();
    expect(userFromAuthStateCookies('other=1', 'lt-auth-state')).toBeNull();
    expect(userFromAuthStateCookies('', 'lt-auth-state')).toBeNull();
    expect(userFromAuthStateCookies(undefined, 'lt-auth-state')).toBeNull();
  });
});

describe('readAuthStateUser (server render)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stub(names: { state: string }, header: string | undefined, jarState: unknown = null) {
    const useCookie = vi.fn(() => ({ value: jarState }));
    vi.stubGlobal('getLtAuthCookieNames', () => ({ ...names, token: 'unused' }));
    vi.stubGlobal('useRequestHeaders', () => (header === undefined ? {} : { cookie: header }));
    vi.stubGlobal('useCookie', useCookie);
    return { useCookie };
  }

  it('reads the request under the name the library resolves', () => {
    stub({ state: 'my-app-auth-state' }, [entry('lt-auth-state', { user: { id: 'ghost' } }), entry('my-app-auth-state', { user: USER })].join('; '));

    expect(readAuthStateUser()).toEqual(USER);
  });

  it('finds the signed-in twin behind a user-less one', () => {
    stub({ state: 'lt-auth-state' }, [entry('lt-auth-state', { user: null }), entry('lt-auth-state', { user: USER })].join('; '));

    expect(readAuthStateUser()).toEqual(USER);
  });

  it('falls back to the cookie the render itself set, as useLtAuth() does', () => {
    const { useCookie } = stub({ state: 'lt-auth-state' }, undefined, { authMode: 'cookie', user: USER });

    expect(readAuthStateUser()).toEqual(USER);
    expect(useCookie).toHaveBeenCalledWith('lt-auth-state');
  });

  it('returns null when neither the request nor the render has a user', () => {
    stub({ state: 'lt-auth-state' }, entry('lt-auth-state', { user: null }), { user: null });

    expect(readAuthStateUser()).toBeNull();
  });
});
