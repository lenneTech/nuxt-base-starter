/**
 * Mounts the real app/pages/auth/login.vue and pins the sign-in through a social provider.
 *
 * WHAT IT PINS
 *
 * - One button per provider `/iam/features` lists, next to the passkey button. A click starts an
 *   interactive sign-in (`prompt=select_account`) with absolute `callbackURL` / `errorCallbackURL`
 *   built from the app origin and the VALIDATED deep link, never from the raw query.
 * - `?error=` from the provider or Better Auth: the code is read once into state and mapped to a
 *   fixed text; `error` and `error_description` leave the URL (`router.replace`), everything else
 *   stays; the description never reaches the DOM; the alert goes when a new sign-in starts.
 * - The silent attempt (`NUXT_PUBLIC_AUTH_SILENT_PROVIDER`): it waits for the provider list, runs
 *   once per tab with `prompt=none` while the form is hidden behind a status text, and never runs
 *   after an explicit sign-out until the next completed sign-in, with an `error` in the URL, or for a
 *   provider the API does not list.
 * - Its first paint: with the setting the server renders the status text and hides the form, the
 *   browser hydrates the same markup, and the form appears as soon as the page knows no attempt will
 *   run (a mark, blocked storage, the provider not listed, `/iam/features` failed, the timeout).
 * - The return from the provider through the back/forward cache frees the buttons and the form.
 * - The sign-in methods `/iam/features` reports: without `emailAndPassword` (an API before nest-server
 *   12.11.0) the form stays; with `emailAndPassword: false` the form, "Passwort vergessen?" and
 *   "Registrieren" go, `passkey: false` takes the passkey button, and a page left with no method says
 *   so. With the features the server fetched, its HTML already shows the right methods. That the server
 *   fetches them at all (`import.meta.server`, never true here) is checked against a real API by
 *   `tests/e2e/auth-sign-in-methods.spec.ts`.
 *
 * What the request on the wire looks like is pinned in nuxt-extensions (`better-auth-contract`:
 * `POST /iam/sign-in/social` with the caller's fields intact); `tests/e2e/auth-social-sign-in.spec.ts`
 * checks it in a browser against a stubbed API.
 *
 * HOW
 *
 * As in `auth-2fa.test.ts`: no Nuxt environment, so the auto-imports are globals (the real
 * `app/utils` functions where the page uses them), `useLtAuth()` is a fake, and the Nuxt UI
 * components are stubs that render their slots.
 *
 * `features` and `fetchFeatures()` behave like the library's: the features are a shared state that
 * starts empty on the client and fills when `/iam/features` answers, and `fetchFeatures()` resolves
 * then, or with the state unchanged when the request failed (`failFeatures()`), or never.
 *
 * With `ssr: true` the page is first rendered to a string, as the server does, and then hydrated into
 * the DOM, as the browser does: `html` is the server markup, and every warning Vue gives during
 * hydration (a mismatch, above all) lands in `warnings`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computed,
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  watch,
  type App,
  type Component,
  type PropType,
  type Ref,
} from 'vue';
import { renderToString } from 'vue/server-renderer';

import LoginPage from '~/pages/auth/login.vue';
import { appUrl } from '~/utils/app-origin';
import { safeRedirectTarget } from '~/utils/safe-redirect-target';
import * as socialSignIn from '~/utils/social-sign-in';

const SITE_URL = 'https://app.example.com';
const DESCRIPTION = 'AADSTS50058: A silent sign-in request was sent but no user is signed in. Trace ID: 0f1e2d3c Correlation ID: 4b5a6978';

interface MountOptions {
  /** `runtimeConfig.public.authSilentProvider`. */
  silentProvider?: string;
  /** What `signIn.social` answers. */
  socialAnswer?: unknown;
  /** The query the page is opened with. */
  query?: Record<string, unknown>;
  /** `/iam/features` as `useLtAuth().features` holds it: the browser's answer; changeable after mount. */
  features?: Record<string, unknown>;
  /**
   * What `/iam/features` answered the server (`login-server-features`), as the payload brings it to the
   * browser; changeable after mount through `serverState`.
   */
  serverFeatures?: Record<string, unknown>;
  /** What `signIn.email` answers. */
  emailAnswer?: unknown;
  /** What `authenticateWithPasskey()` answers. */
  passkeyAnswer?: unknown;
  /** Render on the "server" first and hydrate that markup, instead of a plain client mount. */
  ssr?: boolean;
}

/** Lets timers, promises and Vue's scheduler run; with fake timers it advances them by zero. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await new Promise((resolve) => setTimeout(resolve));
    }
    await nextTick();
  }
}

async function mountLogin(options: MountOptions = {}) {
  const social = vi.fn(async (_params: unknown) => options.socialAnswer ?? { data: { redirect: true, url: 'https://login.example.com/authorize' }, error: null });
  const features: Ref<Record<string, unknown>> = ref(options.features ?? {});
  // Requests to `/iam/features` still open: each resolves when the features land, or on `failFeatures()`.
  const openFeatureRequests: Array<() => void> = [];
  const fetchFeatures = vi.fn(
    () =>
      new Promise<Record<string, unknown>>((resolve) => {
        if (Object.keys(features.value).length > 0) {
          resolve(features.value);
          return;
        }
        const stop = watch(features, (value) => {
          stop();
          resolve(value);
        });
        openFeatureRequests.push(() => {
          stop();
          resolve(features.value);
        });
      }),
  );
  // `useState` as Nuxt's: one value per key, shared by the "server" render and the "browser", as the payload
  // shares it. The page's own server request (`import.meta.server`) never runs here; `serverFeatures` stands
  // for its answer.
  const states = new Map<string, Ref<unknown>>([['login-server-features', ref(options.serverFeatures ?? null)]]);
  const useState = <T>(key: string, init: () => T): Ref<T> => {
    if (!states.has(key)) {
      states.set(key, ref(init()));
    }
    return states.get(key) as Ref<T>;
  };
  const route = reactive({ hash: '', path: '/auth/login', query: { ...options.query } as Record<string, unknown> });
  const replace = vi.fn(async (to: { query: Record<string, unknown> }) => {
    route.query = to.query;
  });
  const toasts: Array<{ description: string; title: string }> = [];
  const submits: Array<(data: Record<string, string>) => Promise<void>> = [];
  const navigateTo = vi.fn(async (_to: unknown) => {});

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('onUnmounted', onUnmounted);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('useState', useState);
  vi.stubGlobal('getLtApiBase', () => 'http://api.test/iam');
  vi.stubGlobal(
    '$fetch',
    vi.fn(async () => Promise.reject(new Error('no request in a unit test'))),
  );
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useRoute', () => route);
  vi.stubGlobal('useRouter', () => ({ replace }));
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { authSilentProvider: options.silentProvider ?? '', siteUrl: SITE_URL } }));
  vi.stubGlobal('useToast', () => ({ add: (toast: { description: string; title: string }) => toasts.push(toast) }));
  vi.stubGlobal('useLtErrorTranslation', () => ({ translateError: (message: string) => message }));
  vi.stubGlobal('useLtAuth', () => ({
    authenticateWithPasskey: vi.fn(async () => options.passkeyAnswer ?? { success: false }),
    features,
    fetchFeatures,
    setUser: vi.fn(),
    signIn: { email: vi.fn(async () => options.emailAnswer ?? { error: { message: 'wrong' } }), social },
    validateSession: vi.fn(),
  }));
  vi.stubGlobal('safeRedirectTarget', safeRedirectTarget);
  vi.stubGlobal('appUrl', appUrl);
  vi.stubGlobal('verifyEmailState', vi.fn());
  for (const [name, value] of Object.entries(socialSignIn)) {
    vi.stubGlobal(name, value);
  }

  const errors: unknown[] = [];
  const warnings: string[] = [];
  const slotted = (tag: string) =>
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h(tag, slots.default?.()),
    });
  // The same stubs on the "server" and in the "browser", so a mismatch can only come from the page.
  const withStubs = (app: App): App => {
    app.component('UPageCard', slotted('section'));
    app.component('USeparator', defineComponent({ render: () => h('hr') }));
    app.component('ULink', slotted('a'));
    app.component(
      'UAlert',
      defineComponent({
        props: { description: { default: '', type: String }, title: { default: '', type: String } },
        setup: (props) => () => h('div', { 'data-alert': '' }, [h('strong', props.title), h('p', props.description)]),
      }),
    );
    app.component(
      'UButton',
      defineComponent({
        props: { disabled: { default: false, type: Boolean }, icon: { default: undefined, type: String }, loading: { default: false, type: Boolean } },
        setup:
          (props, { slots }) =>
          () =>
            h('button', { 'data-icon': props.icon, 'data-loading': props.loading ? 'true' : undefined, disabled: props.disabled }, slots.default?.()),
      }),
    );
    // As Nuxt UI's: the form, and the hint of the password field in it, only while there are fields.
    app.component(
      'UAuthForm',
      defineComponent({
        emits: ['submit'],
        props: { fields: { default: () => [], type: Array as PropType<Array<{ name: string }>> } },
        setup(props, { emit, slots }) {
          submits.push(async (data) => {
            emit('submit', { data });
            await settle();
          });
          return () =>
            h('div', { 'data-slot': 'root' }, [
              slots.title?.(),
              props.fields.length > 0 ? h('form', [props.fields.some((field) => field.name === 'password') ? slots['password-hint']?.() : null]) : null,
              slots.footer?.(),
            ]);
        },
      }),
    );
    app.config.errorHandler = (err) => errors.push(err);
    app.config.warnHandler = (message) => warnings.push(message);
    return app;
  };

  // The page awaits `/iam/features` during SSR (`import.meta.server`, never true here), which makes its
  // setup asynchronous: as in Nuxt, it renders inside <Suspense>, which adds no element of its own.
  const suspended = defineComponent({ render: () => h(Suspense, null, { default: () => h(LoginPage as Component) }) });
  const root = document.createElement('div');
  document.body.append(root);
  let html: string | undefined;
  let app: App;
  if (options.ssr) {
    // The server knows the runtime config and the query, never the browser's storage: a page that
    // read the marks while rendering would decide differently there and in the browser.
    const tabStorage = window.sessionStorage;
    const sharedStorage = window.localStorage;
    const noStorage = (): never => {
      throw new Error('no browser storage on the server');
    };
    vi.stubGlobal('sessionStorage', { getItem: noStorage, removeItem: noStorage, setItem: noStorage });
    vi.stubGlobal('localStorage', { getItem: noStorage, removeItem: noStorage, setItem: noStorage });
    try {
      html = await renderToString(withStubs(createSSRApp(suspended)));
    } finally {
      vi.stubGlobal('sessionStorage', tabStorage);
      vi.stubGlobal('localStorage', sharedStorage);
    }
    root.innerHTML = html;
    const hydrationErrors = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
    app = withStubs(createSSRApp(suspended));
    app.mount(root);
    hydrationErrors.mockRestore();
  } else {
    app = withStubs(createApp(suspended));
    app.mount(root);
  }
  await settle();

  const buttons = () => [...root.querySelectorAll('button')];
  const button = (label: string) => buttons().find((candidate) => candidate.textContent?.trim() === label);

  return {
    button,
    buttons,
    errors,
    /** Lets every open `/iam/features` request fail: the features stay as they are. */
    failFeatures: () => openFeatureRequests.splice(0).forEach((fail) => fail()),
    features,
    fetchFeatures,
    html,
    navigateTo,
    replace,
    root,
    route,
    /** What the server's request for `/iam/features` answered, as the payload carries it. */
    serverState: states.get('login-server-features') as Ref<null | Record<string, unknown>>,
    social,
    status: () => root.querySelector('[role="status"]'),
    submit: (data: Record<string, string>) => submits.at(-1)!(data),
    toasts,
    unmount: () => {
      app.unmount();
      root.remove();
    },
    warnings,
    wrapper: () => root.querySelector('[data-slot="root"]')?.parentElement as HTMLElement,
  };
}

/** The element around the form in server markup, as the browser parses it before any script runs. */
function serverWrapper(html: string | undefined): HTMLElement {
  const parsed = document.createElement('div');
  parsed.innerHTML = html ?? '';
  return parsed.querySelector('[data-slot="root"]')?.parentElement as HTMLElement;
}

/** Vue's hydration warnings among those a hydrated page collected (a mismatch, above all). */
function hydrationWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => /hydrat/i.test(warning));
}

beforeEach(() => {
  // "Attempted" lives in sessionStorage, "signed out" in localStorage (shared by every tab).
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('login page: a button per provider', () => {
  it('shows one button per provider /iam/features lists, before the passkey button', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft', 'github'] } });

    const labels = page.buttons().map((candidate) => candidate.textContent?.trim());
    expect(labels).toEqual(['Mit Microsoft anmelden', 'Mit GitHub anmelden', 'Mit Passkey anmelden']);
    expect(page.button('Mit Microsoft anmelden')?.dataset.icon).toBe('i-lucide-grid-2x2');
    expect(page.errors).toEqual([]);
    page.unmount();
  });

  it('shows none while the API lists none', async () => {
    const page = await mountLogin({ features: { signUpEnabled: true } });

    expect(page.buttons().map((candidate) => candidate.textContent?.trim())).toEqual(['Mit Passkey anmelden']);
    page.unmount();
  });

  it('starts an interactive sign-in with absolute URLs built from the validated deep link', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, query: { redirect: '/app/records/42?tab=x' } });

    page.button('Mit Microsoft anmelden')?.click();
    await settle();

    expect(page.social).toHaveBeenCalledTimes(1);
    expect(page.social).toHaveBeenCalledWith({
      additionalParams: { prompt: 'select_account' },
      callbackURL: `${SITE_URL}/auth/callback?redirect=%2Fapp%2Frecords%2F42%3Ftab%3Dx`,
      errorCallbackURL: `${SITE_URL}/auth/login?redirect=%2Fapp%2Frecords%2F42%3Ftab%3Dx`,
      provider: 'microsoft',
    });
    // The browser is leaving for the provider: the button keeps spinning, the others wait.
    expect(page.button('Mit Microsoft anmelden')?.dataset.loading).toBe('true');
    expect(page.button('Mit Passkey anmelden')?.disabled).toBe(false);
    page.unmount();
  });

  it('never puts a foreign target from the query into the URLs', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, query: { redirect: '//evil.example' } });

    page.button('Mit Microsoft anmelden')?.click();
    await settle();

    const params = page.social.mock.calls[0]?.[0] as { callbackURL: string; errorCallbackURL: string };
    expect(params.callbackURL).toBe(`${SITE_URL}/auth/callback?redirect=%2Fapp`);
    expect(params.errorCallbackURL).toBe(`${SITE_URL}/auth/login?redirect=%2Fapp`);
    page.unmount();
  });

  it('says so and frees the button when the API refuses to start', async () => {
    const page = await mountLogin({
      features: { socialProviders: ['microsoft'] },
      socialAnswer: { data: null, error: { message: '#LTNS_0000: Provider not found', status: 404 } },
    });

    page.button('Mit Microsoft anmelden')?.click();
    await settle();

    expect(page.toasts.at(-1)).toEqual({ color: 'error', description: '#LTNS_0000: Provider not found', title: 'Anmeldung fehlgeschlagen' });
    expect(page.button('Mit Microsoft anmelden')?.dataset.loading).toBeUndefined();
    page.unmount();
  });
});

describe('login page: back with ?error=', () => {
  it('shows the refusal, removes error and error_description from the URL, and keeps redirect', async () => {
    const page = await mountLogin({
      features: { socialProviders: ['microsoft'] },
      query: { error: 'access_denied', error_description: DESCRIPTION, redirect: '/app/x' },
    });

    expect(page.replace).toHaveBeenCalledTimes(1);
    expect(page.replace).toHaveBeenCalledWith({ hash: '', query: { redirect: '/app/x' } });
    expect(page.route.query).toEqual({ redirect: '/app/x' });
    expect(page.root.textContent).toContain('Kein Zugang');
    expect(page.root.textContent).toContain('Dieses Konto ist für diese Anwendung nicht freigeschaltet.');
    expect(page.root.textContent).not.toContain('AADSTS50058');
    expect(page.root.innerHTML).not.toContain('Trace ID');
    page.unmount();
  });

  it('keeps the message from state after the URL is clean, and drops it when a new sign-in starts', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, query: { error: 'access_denied', redirect: '/app/x' } });

    expect(page.root.querySelector('[data-alert]')).not.toBeNull();

    page.button('Mit Microsoft anmelden')?.click();
    await settle();

    expect(page.root.querySelector('[data-alert]')).toBeNull();
    page.unmount();
  });

  it('shows nothing after a silent attempt without a provider session, and cleans the URL', async () => {
    const page = await mountLogin({ query: { error: 'login_required', error_description: DESCRIPTION, redirect: '/app' } });

    expect(page.root.querySelector('[data-alert]')).toBeNull();
    expect(page.replace).toHaveBeenCalledWith({ hash: '', query: { redirect: '/app' } });
    page.unmount();
  });

  it.each([
    ['session_missing', 'Anmeldung fehlgeschlagen'],
    ['access_denied', 'Kein Zugang'],
  ])('announces the message for %s: the alert carries role="alert"', async (code, title) => {
    // `callback.vue` comes here by a client-side navigation: focus stays on the body, the title does
    // not change, and the page's status region is empty. Without the role a screen-reader user last
    // hears "Anmeldung wird abgeschlossen …" and is never told that the sign-in failed.
    const page = await mountLogin({ query: { error: code, redirect: '/app/x' } });

    const alert = page.root.querySelector('[role="alert"]');
    expect(alert?.hasAttribute('data-alert')).toBe(true);
    expect(alert?.textContent).toContain(title);
    page.unmount();
  });

  it.each([
    ['login_required', { error: 'login_required' }],
    ['consent_required', { error: 'consent_required' }],
    ['no error', {}],
  ])('renders no alert role for %s', async (_case, query) => {
    const page = await mountLogin({ query });

    expect(page.root.querySelector('[role="alert"]')).toBeNull();
    page.unmount();
  });

  it('never shows text from the query as the message', async () => {
    const page = await mountLogin({ query: { error: 'Ihr Konto ist gesperrt, rufen Sie 0800 123 an' } });

    expect(page.root.textContent).toContain('Die Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.');
    expect(page.root.textContent).not.toContain('0800');
    page.unmount();
  });

  it('asks to start again after an expired sign-in that came back without redirect, and falls back to /app', async () => {
    // nest-server sends a callback whose state it cannot read to the login page with the code only:
    // the state that carried `redirect` is gone.
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, query: { error: 'state_mismatch' } });

    expect(page.root.textContent).toContain('Anmeldung abgebrochen');
    expect(page.root.textContent).toContain('Die Anmeldung hat zu lange gedauert oder wurde unterbrochen. Bitte starte sie erneut.');
    expect(page.route.query).toEqual({});

    page.button('Mit Microsoft anmelden')?.click();
    await settle();

    expect(page.social).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: `${SITE_URL}/auth/callback?redirect=%2Fapp`,
        errorCallbackURL: `${SITE_URL}/auth/login?redirect=%2Fapp`,
      }),
    );
    page.unmount();
  });

  it('leaves a URL without error alone', async () => {
    const page = await mountLogin({ query: { redirect: '/app/x' } });

    expect(page.replace).not.toHaveBeenCalled();
    page.unmount();
  });
});

describe('login page: the silent attempt', () => {
  it('waits for the provider list, then runs once with prompt=none behind a status text', async () => {
    const page = await mountLogin({ query: { redirect: '/app/x' }, silentProvider: 'microsoft' });
    expect(page.social).not.toHaveBeenCalled();

    page.features.value = { socialProviders: ['microsoft'] };
    await settle();

    expect(page.social).toHaveBeenCalledTimes(1);
    expect(page.social).toHaveBeenCalledWith({
      additionalParams: { prompt: 'none' },
      callbackURL: `${SITE_URL}/auth/callback?redirect=%2Fapp%2Fx`,
      errorCallbackURL: `${SITE_URL}/auth/login?redirect=%2Fapp%2Fx`,
      provider: 'microsoft',
    });
    expect(page.status()?.textContent).toBe('Anmeldung wird geprüft …');
    expect(page.wrapper().style.display).toBe('none');

    // The features arrive again (another useLtAuth() caller): still one attempt.
    page.features.value = { socialProviders: ['microsoft', 'github'] };
    await settle();
    expect(page.social).toHaveBeenCalledTimes(1);
    page.unmount();
  });

  it('does not run again in the same tab, so a return without provider session cannot loop', async () => {
    const first = await mountLogin({ features: { socialProviders: ['microsoft'] }, silentProvider: 'microsoft' });
    expect(first.social).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = await mountLogin({ features: { socialProviders: ['microsoft'] }, silentProvider: 'microsoft' });

    expect(second.social).not.toHaveBeenCalled();
    expect(second.wrapper().style.display).toBe('');
    second.unmount();
  });

  it('does not run after an explicit sign-out', async () => {
    socialSignIn.socialSignInMarks.markSignedOut();

    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, silentProvider: 'microsoft' });

    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it('does not run when the page was reached with an error, even after the URL is clean', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, query: { error: 'access_denied' }, silentProvider: 'microsoft' });

    page.features.value = { socialProviders: ['microsoft', 'github'] };
    await settle();

    expect(page.route.query).toEqual({});
    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it('does not run for a provider the API does not list', async () => {
    const page = await mountLogin({ features: { socialProviders: ['github'] }, silentProvider: 'microsoft' });

    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it('is off without NUXT_PUBLIC_AUTH_SILENT_PROVIDER', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] } });

    expect(page.social).not.toHaveBeenCalled();
    expect(page.status()?.textContent).toBe('');
    page.unmount();
  });

  it('shows the form again when the API refuses to start the attempt', async () => {
    const page = await mountLogin({
      features: { socialProviders: ['microsoft'] },
      silentProvider: 'microsoft',
      socialAnswer: { data: null, error: { message: 'down', status: 503 } },
    });

    expect(page.social).toHaveBeenCalledTimes(1);
    expect(page.wrapper().style.display).toBe('');
    expect(page.status()?.textContent).toBe('');
    expect(page.toasts).toEqual([]);
    page.unmount();
  });
});

describe('login page: a successful sign-in clears the marks', () => {
  // So that, after the session expired, the next visit may try the silent sign-in again.
  function markTab(): void {
    socialSignIn.socialSignInMarks.markSilentAttempt();
    socialSignIn.socialSignInMarks.markSignedOut();
  }

  it('clears them after a password sign-in', async () => {
    markTab();
    const page = await mountLogin({ emailAnswer: { data: { user: { id: 'u1' } }, error: null } });

    await page.submit({ email: 'max@test.com', password: 'secret-1' });

    expect(page.navigateTo).toHaveBeenCalledWith('/app');
    expect(socialSignIn.socialSignInMarks.maySignInSilently()).toBe(true);
    page.unmount();
  });

  it('keeps them after a refused password sign-in', async () => {
    markTab();
    const page = await mountLogin({ emailAnswer: { error: { message: 'Invalid password' } } });

    await page.submit({ email: 'max@test.com', password: 'secret-1' });

    expect(socialSignIn.socialSignInMarks.maySignInSilently()).toBe(false);
    page.unmount();
  });

  it('keeps them while the password sign-in waits for the second factor', async () => {
    // Not signed in yet: `2fa.vue` clears them once the code is accepted.
    markTab();
    const page = await mountLogin({ emailAnswer: { data: { requiresTwoFactor: true }, error: null } });

    await page.submit({ email: 'max@test.com', password: 'secret-1' });

    expect(page.navigateTo).toHaveBeenCalledWith({ path: '/auth/2fa', query: {} });
    expect(socialSignIn.socialSignInMarks.maySignInSilently()).toBe(false);
    page.unmount();
  });

  it('clears them after a passkey sign-in', async () => {
    markTab();
    const page = await mountLogin({ passkeyAnswer: { success: true, user: { id: 'u1' } } });

    page.button('Mit Passkey anmelden')?.click();
    await settle();

    expect(page.navigateTo).toHaveBeenCalledWith('/app');
    expect(socialSignIn.socialSignInMarks.maySignInSilently()).toBe(true);
    page.unmount();
  });

  it('keeps them after a failed passkey sign-in', async () => {
    markTab();
    const page = await mountLogin({ passkeyAnswer: { error: 'cancelled', success: false } });

    page.button('Mit Passkey anmelden')?.click();
    await settle();

    expect(socialSignIn.socialSignInMarks.maySignInSilently()).toBe(false);
    page.unmount();
  });
});

describe('login page: back from the provider through the back/forward cache', () => {
  // happy-dom's PageTransitionEvent drops `persisted` (as in analytics-url.test.ts).
  const pageShow = (persisted: boolean) => window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));

  it('frees the provider buttons when the page is restored', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft', 'github'] } });
    page.button('Mit Microsoft anmelden')?.click();
    await settle();
    expect(page.button('Mit Microsoft anmelden')?.dataset.loading).toBe('true');
    expect(page.button('Mit GitHub anmelden')?.disabled).toBe(true);

    pageShow(true);
    await settle();

    expect(page.button('Mit Microsoft anmelden')?.dataset.loading).toBeUndefined();
    expect(page.button('Mit GitHub anmelden')?.disabled).toBe(false);
    page.unmount();
  });

  it('shows the form again when the page is restored during the silent attempt, without a second attempt', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] }, silentProvider: 'microsoft' });
    expect(page.wrapper().style.display).toBe('none');

    pageShow(true);
    await settle();

    expect(page.wrapper().style.display).toBe('');
    expect(page.status()?.textContent).toBe('');
    expect(page.social).toHaveBeenCalledTimes(1);
    page.unmount();
  });

  it('leaves an ordinary page show alone', async () => {
    const page = await mountLogin({ features: { socialProviders: ['microsoft'] } });
    page.button('Mit Microsoft anmelden')?.click();
    await settle();

    pageShow(false);
    await settle();

    expect(page.button('Mit Microsoft anmelden')?.dataset.loading).toBe('true');
    page.unmount();
  });
});

describe('login page: the first paint with the silent attempt configured', () => {
  // With `NUXT_PUBLIC_AUTH_SILENT_PROVIDER` set, single sign-on is the normal way in. The server
  // renders "Anmeldung wird geprüft …" instead of the form, so nobody starts typing into a form the
  // attempt takes away. The marks live in browser storage (sessionStorage and localStorage), which the
  // server cannot see: the page decides after mount and shows the form as soon as it knows no attempt
  // will run.
  const CHECKING = 'Anmeldung wird geprüft …';

  it('renders the checking state on the server, hydrates without a mismatch, and keeps it while the attempt runs', async () => {
    const page = await mountLogin({ silentProvider: 'microsoft', ssr: true });

    // What the browser shows before any script runs: the status text, the form hidden.
    expect(page.html).toContain(CHECKING);
    expect(serverWrapper(page.html).style.display).toBe('none');
    expect(hydrationWarnings(page.warnings)).toEqual([]);
    // Mounted, waiting for the provider list: still the checking state.
    expect(page.wrapper().style.display).toBe('none');
    expect(page.status()?.textContent).toBe(CHECKING);

    page.features.value = { socialProviders: ['microsoft'] };
    await settle();

    expect(page.social).toHaveBeenCalledTimes(1);
    expect(page.wrapper().style.display).toBe('none');
    expect(page.status()?.textContent).toBe(CHECKING);
    page.unmount();
  });

  it.each([
    ['attempted', () => socialSignIn.socialSignInMarks.markSilentAttempt()],
    ['signed out', () => socialSignIn.socialSignInMarks.markSignedOut()],
  ])('shows the form after mount, without an attempt, with the mark %s', async (_mark, mark) => {
    mark();

    const page = await mountLogin({ silentProvider: 'microsoft', ssr: true });

    expect(serverWrapper(page.html).style.display).toBe('none');
    expect(hydrationWarnings(page.warnings)).toEqual([]);
    expect(page.wrapper().style.display).toBe('');
    expect(page.status()?.textContent).toBe('');

    page.features.value = { socialProviders: ['microsoft'] };
    await settle();
    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it.each(['sessionStorage', 'localStorage'])('shows the form after mount when %s is blocked', async (store) => {
    const blocked = (): never => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    };
    vi.stubGlobal(store, { getItem: blocked, removeItem: blocked, setItem: blocked });

    const page = await mountLogin({ silentProvider: 'microsoft', ssr: true });

    expect(page.wrapper().style.display).toBe('');
    page.features.value = { socialProviders: ['microsoft'] };
    await settle();
    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it('shows the form once the features arrive without the provider', async () => {
    const page = await mountLogin({ silentProvider: 'microsoft', ssr: true });
    expect(page.wrapper().style.display).toBe('none');

    page.features.value = { socialProviders: ['github'] };
    await settle();

    expect(page.wrapper().style.display).toBe('');
    expect(page.status()?.textContent).toBe('');
    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it('shows the form at once when /iam/features fails, and starts nothing when the list arrives later', async () => {
    const page = await mountLogin({ silentProvider: 'microsoft', ssr: true });
    expect(page.wrapper().style.display).toBe('none');

    page.failFeatures();
    await settle();

    expect(page.wrapper().style.display).toBe('');
    expect(page.status()?.textContent).toBe('');

    // The visitor may be typing by now: a late list must not take the form away.
    page.features.value = { socialProviders: ['microsoft'] };
    await settle();
    expect(page.social).not.toHaveBeenCalled();
    expect(page.wrapper().style.display).toBe('');
    page.unmount();
  });

  it('shows the form after the timeout when the features never arrive', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const page = await mountLogin({ silentProvider: 'microsoft', ssr: true });
    expect(page.wrapper().style.display).toBe('none');

    await vi.advanceTimersByTimeAsync(socialSignIn.SILENT_SIGN_IN_FEATURES_TIMEOUT_MS - 10);
    await settle();
    expect(page.wrapper().style.display).toBe('none');

    await vi.advanceTimersByTimeAsync(10);
    await settle();
    expect(page.wrapper().style.display).toBe('');
    expect(page.status()?.textContent).toBe('');

    page.features.value = { socialProviders: ['microsoft'] };
    await settle();
    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });

  it('renders the form on the server without the setting', async () => {
    const page = await mountLogin({ ssr: true });

    expect(page.html).not.toContain(CHECKING);
    expect(serverWrapper(page.html).style.display).toBe('');
    expect(hydrationWarnings(page.warnings)).toEqual([]);
    expect(page.wrapper().style.display).toBe('');
    expect(page.fetchFeatures).not.toHaveBeenCalled();
    page.unmount();
  });

  it('renders the form and the message on the server when reached with ?error=', async () => {
    const page = await mountLogin({ query: { error: 'access_denied', redirect: '/app/x' }, silentProvider: 'microsoft', ssr: true });

    expect(page.html).not.toContain(CHECKING);
    expect(page.html).toContain('Kein Zugang');
    expect(serverWrapper(page.html).style.display).toBe('');
    expect(hydrationWarnings(page.warnings)).toEqual([]);

    page.features.value = { socialProviders: ['microsoft'] };
    await settle();
    expect(page.wrapper().style.display).toBe('');
    expect(page.social).not.toHaveBeenCalled();
    page.unmount();
  });
});

describe('login page: the sign-in methods /iam/features reports', () => {
  /** What the page shows, in order: the form and its links, the buttons, the hint. */
  function methods(page: Awaited<ReturnType<typeof mountLogin>>) {
    return {
      buttons: page.buttons().map((candidate) => candidate.textContent?.trim()),
      form: page.root.querySelector('form') !== null,
      forgotPassword: page.root.textContent?.includes('Passwort vergessen?') ?? false,
      hint: page.root.querySelector('[data-alert]')?.textContent ?? null,
      register: page.root.textContent?.includes('Registrieren') ?? false,
      separator: page.root.querySelector('hr') !== null,
    };
  }

  it('keeps the form and its links while the API does not report emailAndPassword (before nest-server 12.11.0)', async () => {
    const page = await mountLogin({ features: { passkey: true, signUpEnabled: true, socialProviders: [] } });

    expect(methods(page)).toEqual({ buttons: ['Mit Passkey anmelden'], form: true, forgotPassword: true, hint: null, register: true, separator: true });
    page.unmount();
  });

  it('keeps the form and its links before /iam/features answered', async () => {
    const page = await mountLogin();

    expect(methods(page)).toEqual({ buttons: ['Mit Passkey anmelden'], form: true, forgotPassword: true, hint: null, register: true, separator: true });
    page.unmount();
  });

  it('shows only the providers when the API signs in through them alone', async () => {
    const page = await mountLogin({ features: { emailAndPassword: false, passkey: false, signUpEnabled: true, socialProviders: ['microsoft'], twoFactor: false } });

    expect(methods(page)).toEqual({ buttons: ['Mit Microsoft anmelden'], form: false, forgotPassword: false, hint: null, register: false, separator: false });
    expect(page.root.querySelector('h1')?.textContent).toBe('Anmelden');
    page.unmount();
  });

  it('hides the form when the answer arrives after mount', async () => {
    const page = await mountLogin();

    page.features.value = { emailAndPassword: false, passkey: false, socialProviders: ['microsoft'] };
    await settle();

    expect(methods(page)).toEqual({ buttons: ['Mit Microsoft anmelden'], form: false, forgotPassword: false, hint: null, register: false, separator: false });
    page.unmount();
  });

  it('keeps the passkey button next to the providers while the API reports passkeys on', async () => {
    const page = await mountLogin({ features: { emailAndPassword: false, passkey: true, socialProviders: ['microsoft'] } });

    expect(methods(page)).toEqual({
      buttons: ['Mit Microsoft anmelden', 'Mit Passkey anmelden'],
      form: false,
      forgotPassword: false,
      hint: null,
      register: false,
      separator: false,
    });
    page.unmount();
  });

  it('hides the passkey button while the API reports passkeys off, and the separator with it when nothing else follows', async () => {
    const page = await mountLogin({ features: { emailAndPassword: true, passkey: false, signUpEnabled: true, socialProviders: [] } });

    expect(methods(page)).toEqual({ buttons: [], form: true, forgotPassword: true, hint: null, register: true, separator: false });
    page.unmount();
  });

  it('says so when no sign-in method is left, instead of an empty card', async () => {
    const page = await mountLogin({ features: { emailAndPassword: false, passkey: false, signUpEnabled: true, socialProviders: [] } });

    expect(methods(page)).toEqual({
      buttons: [],
      form: false,
      forgotPassword: false,
      hint: 'Anmeldung nicht möglichFür diese Anwendung ist derzeit keine Anmeldemethode eingerichtet. Bitte wende dich an die Betreiber der Anwendung.',
      register: false,
      separator: false,
    });
    page.unmount();
  });

  it('renders the provider-only page on the server from the features it fetched there, and hydrates without a mismatch', async () => {
    const page = await mountLogin({ serverFeatures: { emailAndPassword: false, passkey: false, socialProviders: ['microsoft'] }, ssr: true });

    expect(page.html).not.toContain('<form');
    expect(page.html).not.toContain('Passwort vergessen?');
    expect(page.html).not.toContain('Registrieren');
    expect(page.html).toContain('Mit Microsoft anmelden');
    expect(page.html).not.toContain('Mit Passkey anmelden');
    expect(hydrationWarnings(page.warnings)).toEqual([]);
    expect(methods(page)).toEqual({ buttons: ['Mit Microsoft anmelden'], form: false, forgotPassword: false, hint: null, register: false, separator: false });
    page.unmount();
  });

  it('words account_not_linked for providers alone when the API has no password, on the server and in the browser', async () => {
    const providersOnly = { emailAndPassword: false, passkey: false, socialProviders: ['microsoft'] };
    const page = await mountLogin({ query: { error: 'account_not_linked' }, serverFeatures: providersOnly, ssr: true });

    expect(page.html).toContain('Bitte melde dich über den Anbieter an, den du bisher genutzt hast');
    expect(page.html).not.toContain('wie bisher an');
    expect(hydrationWarnings(page.warnings)).toEqual([]);

    // The browser's own answer keeps the wording; an API with a password brings the original text back.
    page.features.value = providersOnly;
    await settle();
    expect(page.root.querySelector('[data-alert]')?.textContent).toContain('den du bisher genutzt hast');
    page.features.value = { emailAndPassword: true, socialProviders: ['microsoft'] };
    await settle();
    expect(page.root.querySelector('[data-alert]')?.textContent).toContain('Bitte melde dich wie bisher an');
    page.unmount();
  });

  it("follows the browser's answer once it arrives, over the server's", async () => {
    const page = await mountLogin({ serverFeatures: { emailAndPassword: false, passkey: false, socialProviders: ['microsoft'] }, ssr: true });

    page.features.value = { emailAndPassword: true, passkey: true, signUpEnabled: true, socialProviders: [] };
    await settle();

    expect(methods(page)).toEqual({ buttons: ['Mit Passkey anmelden'], form: true, forgotPassword: true, hint: null, register: true, separator: true });
    page.unmount();
  });

  it("starts the silent attempt from the browser's answer only, not from the server's in the payload", async () => {
    const page = await mountLogin({ serverFeatures: { socialProviders: ['microsoft'] }, silentProvider: 'microsoft' });

    expect(page.button('Mit Microsoft anmelden')).toBeDefined();
    expect(page.social).not.toHaveBeenCalled();
    expect(page.fetchFeatures).toHaveBeenCalledTimes(1);

    page.features.value = { socialProviders: ['microsoft'] };
    await settle();
    expect(page.social).toHaveBeenCalledTimes(1);
    expect(page.social.mock.calls[0]?.[0]).toMatchObject({ additionalParams: { prompt: 'none' }, provider: 'microsoft' });
    page.unmount();
  });

  it('renders the form on the server when /iam/features fails there, and hides it once the browser learns otherwise', async () => {
    const page = await mountLogin({ ssr: true });

    expect(page.html).toContain('<form');
    expect(page.html).toContain('Passwort vergessen?');
    expect(hydrationWarnings(page.warnings)).toEqual([]);

    page.features.value = { emailAndPassword: false, passkey: false, socialProviders: ['microsoft'] };
    await settle();
    expect(methods(page).form).toBe(false);
    page.unmount();
  });
});
