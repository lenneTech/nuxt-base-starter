/**
 * Mounts the real app/pages/auth/callback.vue, the last step of a sign-in through a social provider.
 *
 * The API's OAuth callback sends the browser here with the session in its httpOnly cookie. The page
 * loads the user (`validateSession()`) and, once the auth state is stored where the route guard
 * reads it, clears the marks of the silent attempt so a later visit may try it again, and goes to
 * the VALIDATED deep link. Without a session, or without a stored auth state, it goes back to the
 * login page with a code of its own, which `login.vue` words and then removes from the URL.
 *
 * Same technique as `auth-2fa.test.ts`: auto-imports as globals, `useLtAuth()` a fake.
 *
 * THE AUTH STATE THE BROWSER KEPT
 *
 * A session alone is not a completed sign-in. `validateSession()` stores the user in the
 * `lt-auth-state` cookie, and the route guard (`auth.global.ts`) and every reload read that cookie
 * from `document.cookie`. When the browser refuses the write (the cookie is over its 4096 bytes),
 * `useLtAuth()` still says "signed in" from the ref `useCookie` keeps in memory, while the guard
 * sends the visitor to the login page. So the fake `validateSession()` writes the auth state into
 * the cookie jar of `tests/unit/setup.ts` the way the library does, unless the case says the browser
 * dropped it, and its `isAuthenticated` stays true either way, like the real ref.
 * `isLtAuthenticated()` is the library's read of `document.cookie` (no in-memory fallback): here it
 * reads the same jar. Its own duplicate-tolerant parsing is pinned in nuxt-extensions
 * (`test/auth-cookie-names.test.ts`); the installed copy cannot be imported here, because it pulls in
 * `#imports` from outside the alias.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, onMounted, ref } from 'vue';

import CallbackPage from '~/pages/auth/callback.vue';
import { safeRedirectTarget } from '~/utils/safe-redirect-target';
import { SOCIAL_SIGN_IN_NO_SESSION, socialSignInMarks } from '~/utils/social-sign-in';

import { resetCookies } from '../setup';

const STATE_COOKIE = 'lt-auth-state';
const USER = { email: 'social@test.com', id: 'social-user-1' };

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

/** Writes the auth state into the cookie jar, as `setUser()` does. */
function writeAuthState(state: { authMode: string; user: unknown }): void {
  document.cookie = `${STATE_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=604800; samesite=lax`;
}

/** True when an auth-state cookie in `document.cookie` carries a user: the contract of `isLtAuthenticated()`. */
function cookieCarriesUser(): boolean {
  return document.cookie
    .split('; ')
    .filter((entry) => entry.startsWith(`${STATE_COOKIE}=`))
    .some((entry) => {
      try {
        return !!JSON.parse(decodeURIComponent(entry.slice(STATE_COOKIE.length + 1)))?.user;
      } catch {
        return false;
      }
    });
}

interface CallbackOptions {
  /** False: the browser refused to store the auth state (an oversized cookie, for example). */
  stored?: boolean;
}

async function mountCallback(validateSession: () => Promise<boolean>, query: Record<string, unknown> = {}, options: CallbackOptions = {}) {
  const navigateTo = vi.fn(async () => {});
  // The ref `useCookie` keeps in memory: true after a valid session, whether or not the write stuck.
  const isAuthenticated = ref(false);
  const validate = vi.fn(async () => {
    const valid = await validateSession();
    if (valid) {
      isAuthenticated.value = true;
      if (options.stored !== false) {
        writeAuthState({ authMode: 'cookie', user: USER });
      }
    }
    return valid;
  });

  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useRoute', () => ({ query }));
  vi.stubGlobal('useLtAuth', () => ({ isAuthenticated, user: computed(() => (isAuthenticated.value ? USER : null)), validateSession: validate }));
  vi.stubGlobal('isLtAuthenticated', cookieCarriesUser);
  vi.stubGlobal('safeRedirectTarget', safeRedirectTarget);
  vi.stubGlobal('socialSignInMarks', socialSignInMarks);
  vi.stubGlobal('SOCIAL_SIGN_IN_NO_SESSION', SOCIAL_SIGN_IN_NO_SESSION);

  const app = createApp(CallbackPage);
  app.component(
    'UPageCard',
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('section', slots.default?.()),
    }),
  );
  const errors: unknown[] = [];
  app.config.errorHandler = (err) => errors.push(err);
  const root = document.createElement('div');
  app.mount(root);
  await settle();

  return { errors, isAuthenticated, navigateTo, root, unmount: () => app.unmount() };
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetCookies();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callback page', () => {
  it('goes to the deep link and clears the marks once the session is there', async () => {
    socialSignInMarks.markSilentAttempt();
    socialSignInMarks.markSignedOut();

    const page = await mountCallback(async () => true, { redirect: '/app/records/42' });

    expect(page.errors).toEqual([]);
    expect(page.navigateTo).toHaveBeenCalledWith('/app/records/42', { replace: true });
    expect(socialSignInMarks.maySignInSilently()).toBe(true);
    page.unmount();
  });

  // The route guard reads `lt-auth-state` from `document.cookie`. Going on without it, the guard sends
  // the visitor to `/auth/login?redirect=…` WITHOUT `error`, the marks are gone, and the login page
  // starts the next silent attempt at once: app, API and provider loop, a session row per round.
  it.each([
    ['nothing', () => {}],
    ['an older state without a user', () => writeAuthState({ authMode: 'cookie', user: null })],
  ])('session there, auth state not stored (the jar holds %s): back to the login page with the code, marks kept', async (_case, jar) => {
    jar();
    socialSignInMarks.markSilentAttempt();

    const page = await mountCallback(async () => true, { redirect: '/app/records/42' }, { stored: false });

    // The composable says signed in; the cookie the guard and a reload read does not.
    expect(page.isAuthenticated.value).toBe(true);
    expect(page.errors).toEqual([]);
    expect(page.navigateTo).toHaveBeenCalledTimes(1);
    expect(page.navigateTo).toHaveBeenCalledWith({ path: '/auth/login', query: { error: 'session_missing', redirect: '/app/records/42' } }, { replace: true });
    // The attempt stays marked, so even the login page without `error` would not start another one.
    expect(socialSignInMarks.maySignInSilently()).toBe(false);
    page.unmount();
  });

  it('never goes to a foreign target from the query', async () => {
    const page = await mountCallback(async () => true, { redirect: '//evil.example' });

    expect(page.navigateTo).toHaveBeenCalledWith('/app', { replace: true });
    page.unmount();
  });

  it('sends the visitor back to the login page with its own code when no session arrived', async () => {
    socialSignInMarks.markSilentAttempt();

    const page = await mountCallback(async () => false, { redirect: '/app/x' });

    expect(page.navigateTo).toHaveBeenCalledWith({ path: '/auth/login', query: { error: 'session_missing', redirect: '/app/x' } }, { replace: true });
    // No session, so the attempt is still marked: the login page must not start the next one.
    expect(socialSignInMarks.maySignInSilently()).toBe(false);
    page.unmount();
  });

  it('treats a failed session check as no session', async () => {
    const page = await mountCallback(async () => {
      throw new Error('network down');
    });

    expect(page.errors).toEqual([]);
    expect(page.navigateTo).toHaveBeenCalledWith({ path: '/auth/login', query: { error: 'session_missing', redirect: '/app' } }, { replace: true });
    page.unmount();
  });

  it('tells screen readers what it is doing', async () => {
    const page = await mountCallback(() => new Promise(() => {}));

    expect(page.root.querySelector('[role="status"]')?.textContent).toBe('Anmeldung wird abgeschlossen …');
    page.unmount();
  });
});
