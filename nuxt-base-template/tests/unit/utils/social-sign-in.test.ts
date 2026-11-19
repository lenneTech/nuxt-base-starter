/**
 * Contract test for `app/utils/social-sign-in.ts`, the pure half of the sign-in through a social
 * provider: button labels and icons, the marks that keep the silent attempt from looping and from
 * undoing a sign-out, and the text for an `?error=` on the way back.
 *
 * The page behaviour built on it is pinned by `tests/unit/pages/auth-login-social.test.ts` and
 * `tests/unit/pages/auth-callback.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configuredSilentProvider,
  hasSignInError,
  SIGNED_OUT_KEY,
  SILENT_ATTEMPTED_KEY,
  silentSignInProvider,
  SOCIAL_PROVIDER_FALLBACK_ICON,
  socialProviderDisplay,
  socialProviderIcons,
  socialProvidersOf,
  socialSignInError,
  socialSignInMarks,
  withoutProviderErrorText,
  withoutSignInError,
} from '../../../app/utils/social-sign-in';

const templateRoot = join(import.meta.dirname, '..', '..', '..');

describe('provider buttons', () => {
  it.each([
    ['microsoft', 'Microsoft', 'i-lucide-grid-2x2'],
    ['google', 'Google', SOCIAL_PROVIDER_FALLBACK_ICON],
    ['github', 'GitHub', 'i-lucide-github'],
    ['apple', 'Apple', 'i-lucide-apple'],
  ])('shows %s as "%s"', (id, label, icon) => {
    expect(socialProviderDisplay(id)).toEqual({ icon, label });
  });

  it('names an unknown provider by its id, capitalised, with the neutral icon', () => {
    expect(socialProviderDisplay('keycloak')).toEqual({ icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Keycloak' });
  });

  it('does not take a name from the object prototype for a provider id', () => {
    expect(socialProviderDisplay('constructor')).toEqual({ icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Constructor' });
  });

  it('uses only icons the installed lucide collection has', () => {
    // The brand marks are deprecated in lucide and may go in an update; the button would then
    // render without an icon and nothing else would notice.
    const collection = JSON.parse(readFileSync(join(templateRoot, 'node_modules/@iconify-json/lucide/icons.json'), 'utf8')) as {
      aliases?: Record<string, unknown>;
      icons: Record<string, unknown>;
    };
    const names = new Set([...Object.keys(collection.icons), ...Object.keys(collection.aliases ?? {})]);

    const missing = socialProviderIcons().filter((icon) => !icon.startsWith('i-lucide-') || !names.has(icon.slice('i-lucide-'.length)));

    expect(socialProviderIcons().length).toBeGreaterThan(5);
    expect(missing).toEqual([]);
  });
});

describe('providers from /iam/features', () => {
  it('reads the listed ids', () => {
    expect(socialProvidersOf({ signUpEnabled: true, socialProviders: ['microsoft', 'github'] })).toEqual(['microsoft', 'github']);
  });

  it('drops what is not a provider id', () => {
    expect(socialProvidersOf({ socialProviders: ['microsoft', '', '  ', 42, null, 'microsoft'] })).toEqual(['microsoft']);
  });

  it.each([[undefined], [null], [{}], [{ socialProviders: 'microsoft' }], [{ socialProviders: true }]])('finds none in %j', (features) => {
    expect(socialProvidersOf(features)).toEqual([]);
  });
});

describe('the provider for the silent attempt', () => {
  it('is configured with an id, known without the API (the server renders the first paint from it)', () => {
    expect(configuredSilentProvider('microsoft')).toBe('microsoft');
    expect(configuredSilentProvider(' microsoft ')).toBe('microsoft');
  });

  it.each([
    ['empty, the default', ''],
    ['blank', '   '],
    ['not a string (Nitro applies destr)', 42],
    ['unset', undefined],
  ])('is not configured when %s', (_label, configured) => {
    expect(configuredSilentProvider(configured)).toBeNull();
  });

  it('is the configured one while the API lists it', () => {
    expect(silentSignInProvider('microsoft', ['github', 'microsoft'])).toBe('microsoft');
    expect(silentSignInProvider(' microsoft ', ['microsoft'])).toBe('microsoft');
  });

  it.each([
    ['empty, the default', '', ['microsoft']],
    ['not listed by the API', 'microsoft', ['github']],
    ['not loaded yet', 'microsoft', []],
    ['not a string (Nitro applies destr)', 42, ['42']],
    ['unset', undefined, ['microsoft']],
  ])('is none when %s', (_label, configured, providers) => {
    expect(silentSignInProvider(configured, providers)).toBeNull();
  });
});

/**
 * A `sessionStorage` of its own, as a second tab of the same browser has: every tab gets a fresh
 * one, while `localStorage` is shared by every tab of the origin.
 */
function tabStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
  };
}

/** A store that throws on every call, as a blocked one does (private modes, site-data settings). */
function blockedStorage(): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  const blocked = (): never => {
    throw new DOMException('Storage is blocked', 'SecurityError');
  };
  return { getItem: blocked, removeItem: blocked, setItem: blocked };
}

describe('marks of the silent attempt', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allow the silent attempt in a fresh tab', () => {
    expect(socialSignInMarks.maySignInSilently()).toBe(true);
  });

  it('allow it once per tab: after the attempt is marked, no further one in this tab', () => {
    expect(socialSignInMarks.markSilentAttempt()).toBe(true);

    expect(socialSignInMarks.maySignInSilently()).toBe(false);
  });

  it('keep the "attempted" mark to its tab: a second tab may try once of its own', () => {
    // The mark exists to stop a loop within one tab, so it lives in that tab's sessionStorage.
    socialSignInMarks.markSilentAttempt();

    vi.stubGlobal('sessionStorage', tabStorage());

    expect(socialSignInMarks.maySignInSilently()).toBe(true);
  });

  it('allow none after an explicit sign-out', () => {
    expect(socialSignInMarks.markSignedOut()).toBe(true);

    expect(socialSignInMarks.maySignInSilently()).toBe(false);
  });

  it('allow none in any other tab of the browser after a sign-out in one, also a tab opened later', () => {
    // The provider session outlives the app's. Measured in a browser while the mark was per tab: a new
    // tab sent `prompt=none` within four seconds of "Abmelden" in the first and was signed in again.
    socialSignInMarks.markSignedOut();

    vi.stubGlobal('sessionStorage', tabStorage());

    expect(socialSignInMarks.maySignInSilently()).toBe(false);
  });

  it('allow it again once a sign-in cleared both marks', () => {
    socialSignInMarks.markSilentAttempt();
    socialSignInMarks.markSignedOut();

    socialSignInMarks.clear();

    expect(socialSignInMarks.maySignInSilently()).toBe(true);
  });

  it('allow it again in every tab once a sign-in in any tab cleared the sign-out', () => {
    const firstTab = window.sessionStorage;
    socialSignInMarks.markSignedOut();

    vi.stubGlobal('sessionStorage', tabStorage());
    socialSignInMarks.clear();
    expect(socialSignInMarks.maySignInSilently()).toBe(true);

    vi.stubGlobal('sessionStorage', firstTab);
    expect(socialSignInMarks.maySignInSilently()).toBe(true);
  });

  it('keep "signed out" in localStorage and "attempted" in sessionStorage, under fixed keys of their own', () => {
    // Both stores are per origin, so two apps on different origins cannot share the marks.
    socialSignInMarks.markSilentAttempt();
    socialSignInMarks.markSignedOut();

    expect(SILENT_ATTEMPTED_KEY).toBe('lt-social-sign-in:silent-attempted');
    expect(SIGNED_OUT_KEY).toBe('lt-social-sign-in:signed-out');
    expect(Object.keys(window.sessionStorage)).toEqual([SILENT_ATTEMPTED_KEY]);
    expect(Object.keys(window.localStorage)).toEqual([SIGNED_OUT_KEY]);
  });

  it('clear both marks from both stores, a "signed out" mark an earlier version left in sessionStorage included', () => {
    window.sessionStorage.setItem(SIGNED_OUT_KEY, '1');
    window.sessionStorage.setItem(SILENT_ATTEMPTED_KEY, '1');
    window.localStorage.setItem(SIGNED_OUT_KEY, '1');
    window.localStorage.setItem(SILENT_ATTEMPTED_KEY, '1');

    socialSignInMarks.clear();

    expect(Object.keys(window.sessionStorage)).toEqual([]);
    expect(Object.keys(window.localStorage)).toEqual([]);
  });

  it('honour a "signed out" mark an earlier version left in sessionStorage until a sign-in clears it', () => {
    // An upgrade must not undo a sign-out made just before it.
    window.sessionStorage.setItem(SIGNED_OUT_KEY, '1');

    expect(socialSignInMarks.maySignInSilently()).toBe(false);
  });

  it('leave other entries of both stores alone when cleared', () => {
    window.sessionStorage.setItem('reset-password-link', 'kept');
    window.localStorage.setItem('other-setting', 'kept');
    socialSignInMarks.markSilentAttempt();
    socialSignInMarks.markSignedOut();

    socialSignInMarks.clear();

    expect(window.sessionStorage.getItem('reset-password-link')).toBe('kept');
    expect(window.localStorage.getItem('other-setting')).toBe('kept');
  });

  it.each(['sessionStorage', 'localStorage'])('allow no silent attempt and fail nowhere when %s is blocked', (store) => {
    // Without storage nothing would stop the next attempt, and nothing would remember a sign-out.
    vi.stubGlobal(store, blockedStorage());

    expect(socialSignInMarks.maySignInSilently()).toBe(false);
    expect(() => socialSignInMarks.markSilentAttempt()).not.toThrow();
    expect(() => socialSignInMarks.markSignedOut()).not.toThrow();
    expect(() => socialSignInMarks.clear()).not.toThrow();
  });

  it.each(['sessionStorage', 'localStorage'])('allow no silent attempt when %s is missing', (store) => {
    vi.stubGlobal(store, undefined);

    expect(socialSignInMarks.maySignInSilently()).toBe(false);
  });

  it('report a sign-out mark that blocked localStorage refused', () => {
    vi.stubGlobal('localStorage', blockedStorage());

    expect(socialSignInMarks.markSignedOut()).toBe(false);
  });

  it('clear the sign-out mark in localStorage while sessionStorage is blocked', () => {
    socialSignInMarks.markSignedOut();
    vi.stubGlobal('sessionStorage', blockedStorage());

    socialSignInMarks.clear();

    expect(window.localStorage.getItem(SIGNED_OUT_KEY)).toBeNull();
  });

  it('report a write that did not stick, so the attempt does not start', () => {
    // A full quota throws on `setItem`; a storage that drops writes silently must not count either.
    vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {}, setItem: () => {} });

    expect(socialSignInMarks.markSilentAttempt()).toBe(false);
  });

  it('report a sign-out mark that did not stick', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => {}, setItem: () => {} });

    expect(socialSignInMarks.markSignedOut()).toBe(false);
  });
});

describe('?error= on the way back', () => {
  it.each(['login_required', 'interaction_required', 'consent_required', 'account_selection_required', 'CONSENT_REQUIRED'])(
    'says nothing for %s: the silent attempt would have needed a page at the provider',
    (code) => {
      // With `prompt=none` the provider answers these four instead of showing its sign-in, a prompt,
      // its consent screen or its account picker (OpenID Connect Core 1.0, 3.1.2.6). `consent_required`
      // is every user of a tenant without admin consent. One click on the provider button
      // (`prompt=select_account`) shows that page and signs the user in; an interactive sign-in never
      // answers these codes, so none of them is a refusal.
      expect(socialSignInError(code)).toBeNull();
    },
  );

  it.each(['access_denied', 'signup_disabled', 'unauthorized_client', 'ACCESS_DENIED'])('calls %s a refusal of the account', (code) => {
    expect(socialSignInError(code)).toEqual({
      description: 'Dieses Konto ist für diese Anwendung nicht freigeschaltet. Bitte wende dich an deine Administration oder melde dich mit einem anderen Konto an.',
      title: 'Kein Zugang',
    });
  });

  it('says that the address belongs to an account that signs in another way (account_not_linked)', () => {
    // Measured: a local account and a provider account with the same e-mail address.
    expect(socialSignInError('account_not_linked')).toEqual({
      description: 'Für diese E-Mail-Adresse gibt es bereits ein Konto mit einer anderen Anmeldeart. Bitte melde dich wie bisher an oder wende dich an die Administration.',
      title: 'Anmeldung nicht möglich',
    });
  });

  it.each(['state_mismatch', 'state_not_found', 'please_restart_the_process'])('asks to start again for %s: the state of the sign-in is gone', (code) => {
    // nest-server sends these to the login page when its callback cannot read the state: a sign-in
    // that took longer than ten minutes at the provider, or a callback opened twice.
    expect(socialSignInError(code)).toEqual({
      description: 'Die Anmeldung hat zu lange gedauert oder wurde unterbrochen. Bitte starte sie erneut.',
      title: 'Anmeldung abgebrochen',
    });
  });

  it.each(['oauth_provider_not_found', 'email_not_verified', 'internal_server_error', 'session_missing'])('names any other code for support (%s)', (code) => {
    expect(socialSignInError(code)).toEqual({
      description: `Die Anmeldung wurde nicht abgeschlossen (Fehlercode: ${code}). Bitte versuche es erneut.`,
      title: 'Anmeldung fehlgeschlagen',
    });
  });

  it('does not take a message from the object prototype for a code', () => {
    expect(socialSignInError('constructor')?.title).toBe('Anmeldung fehlgeschlagen');
  });

  it('shows no text from the query that is not shaped like a code', () => {
    // Anybody can send a link to `/auth/login?error=…`. Only a code is repeated, never prose.
    const message = socialSignInError('Ihr Konto ist gesperrt, rufen Sie 0800 123 an');

    expect(message?.title).toBe('Anmeldung fehlgeschlagen');
    expect(message?.description).toBe('Die Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.');
  });

  it('treats a repeated parameter as an unknown failure without repeating it', () => {
    expect(socialSignInError(['access_denied', 'x'])?.description).toBe('Die Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.');
  });

  it.each([[undefined], [null], ['']])('says nothing without a code (%j)', (code) => {
    expect(socialSignInError(code)).toBeNull();
  });
});

describe('cleaning the URL', () => {
  it('drops error and error_description and keeps every other parameter', () => {
    const query = {
      error: 'login_required',
      error_description: 'AADSTS50058: A silent sign-in request was sent but no user is signed in. Trace ID: 1',
      redirect: '/app/x',
      tab: '2',
    };

    expect(withoutSignInError(query)).toEqual({ redirect: '/app/x', tab: '2' });
    expect(query.error).toBe('login_required');
  });

  it('removes only error_description before the page renders, keeping error for the page', () => {
    const query = { error: 'login_required', error_description: 'AADSTS50058: Trace ID: 1', redirect: '/app/x' };

    expect(withoutProviderErrorText(query)).toEqual({ error: 'login_required', redirect: '/app/x' });
  });

  it('knows when there is something to clean', () => {
    expect(hasSignInError({ error: 'access_denied' })).toBe(true);
    expect(hasSignInError({ error_description: 'text' })).toBe(true);
    expect(hasSignInError({ redirect: '/app' })).toBe(false);
  });
});

describe('every sign-out sets the "signed out" mark', () => {
  // A sign-out that does not set the mark lets the silent attempt sign the visitor straight back
  // in, in this tab or any other, because the provider session outlives the app's. New call sites
  // have to be covered too.
  // Paths are compared with `/`: on Windows `readdirSync` and `relative()` return `\`, and the
  // vendored core (`app/core/`, vendor mode) has sign-out calls of its own that are not app code.
  const appDir = join(templateRoot, 'app');
  const files = readdirSync(appDir, { recursive: true })
    .map(String)
    .filter((file) => (file.endsWith('.vue') || file.endsWith('.ts')) && file.split(/[/\\]/)[0] !== 'core')
    .map((file) => join(appDir, file));
  const callers = files.filter((file) => /\bsignOut\(/.test(readFileSync(file, 'utf8'))).map((file) => relative(templateRoot, file).replaceAll('\\', '/'));

  it('finds the sign-out call sites', () => {
    expect([...callers].sort()).toEqual(expect.arrayContaining(['app/layouts/default.vue', 'app/pages/app/index.vue']));
  });

  it.each(callers)('%s sets the "signed out" mark', (file) => {
    expect(readFileSync(join(templateRoot, file), 'utf8')).toMatch(/\.markSignedOut\(\)/);
  });
});
