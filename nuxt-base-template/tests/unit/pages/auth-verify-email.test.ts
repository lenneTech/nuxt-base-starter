/**
 * Mounts the real app/pages/auth/verify-email.vue and drives "send a new e-mail" in every way it can go.
 *
 * WHAT IT PINS
 *
 * From nest-server 12.6.0 on the verification link carries the token only, sealed, and no address.
 * For a refused link (expired, mostly) the page sends that token to
 * `POST /iam/resend-verification-email`, and the API mails the address it belongs to and answers
 * it masked. Nobody types the address, and it never travels. `GET /iam/features` says whether the
 * API takes the token (`resendVerificationByToken`). Without it the page goes on as against 12.5:
 * the address from the link's `&email=` or from login and sign-up, and an input field as the last
 * resort. The refused token stays in the history entry, so a reload offers the new mail again.
 *
 * The round trip against a real API is `tests/e2e/auth-verify-email-url.spec.ts`. An expired token
 * cannot be made there, so the answer with a masked address, and the 429, are pinned here.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the page relies on are provided as
 * globals, `$fetch` and the auth client are fakes with the contract of nest-server 12.6.0 and Better
 * Auth, and the Nuxt UI components are stubs that render what the assertions read. The UForm stub
 * validates with the page's own schema before it emits `submit`, as UForm does.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, type PropType } from 'vue';

import VerifyEmailPage from '~/pages/auth/verify-email.vue';
import { recallVerifyEmail, verifyEmailState } from '~/utils/verify-email-memory';

const API = 'http://api.test/iam';
const RESEND = `${API}/resend-verification-email`;
const SEALED = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..aXY.Y2lwaGVy.dGFn';
/** Shaped like a sealed token, but nothing the API can open. */
const GARBLED = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..Z2FyYmxlZA.Z2FyYmxlZA.Z2FyYmxlZA';
/** Better Auth's own token from a mail sent before 12.6.0: its payload names the address and the user. */
const READABLE = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ email: 'max@test.com', userId: 'u1' })).toString('base64url')}.c2ln`;
const RATE_LIMIT_DE = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.';

interface Options {
  /** What `GET /iam/features` answers; `null` lets the request fail. */
  features?: null | Record<string, unknown>;
  /** The URL query the page is opened with. */
  query?: Record<string, string>;
  /** What `POST /iam/resend-verification-email` answers, or throws. */
  resend?: (body: unknown) => unknown;
  /** The history entry the page finds, as after a reload. */
  state?: Record<string, unknown>;
  /** What Better Auth's `verifyEmail` answers. */
  verify?: { data?: { status: boolean }; error?: { message?: string; status: number } };
}

/** A refusal as ofetch throws it: the transport line in `message`, the API's body in `data`. */
function fetchError(status: number, message: string): Error {
  return Object.assign(new Error(`[POST] "${RESEND}": ${status}`), { data: { message, statusCode: status }, statusCode: status });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

async function mountPage(options: Options = {}) {
  const route = reactive({ path: '/auth/verify-email', query: { ...options.query } as Record<string, string> });
  const toasts: Array<{ color: string; description: string; title: string }> = [];
  const errors: unknown[] = [];
  const forms: Array<(data: Record<string, string>) => Promise<string[]>> = [];
  window.history.replaceState(options.state ?? null, '');

  const verifyEmail = vi.fn(async () => options.verify ?? { data: { status: true } });
  const sendVerificationEmail = vi.fn(async () => ({ error: null }));
  const fetch = vi.fn(async (url: string, init?: { body?: unknown; method?: string }) => {
    if (url === `${API}/features`) {
      if (options.features === null) {
        throw new Error('offline');
      }
      return { emailVerification: true, enabled: true, resendCooldownSeconds: 60, ...options.features };
    }
    if (url === RESEND && init?.method === 'POST') {
      return options.resend ? options.resend(init.body) : { email: 'm***@test.com', success: true };
    }
    throw new Error(`unexpected request ${url}`);
  });
  // As vue-router 5: the query is replaced, and the given state merged into the history entry.
  const replace = vi.fn(async (to: { path: string; query: Record<string, string>; state?: Record<string, unknown> }) => {
    route.query = { ...to.query };
    window.history.replaceState({ ...window.history.state, ...to.state }, '');
  });

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('onUnmounted', onUnmounted);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('useRoute', () => route);
  vi.stubGlobal('useRouter', () => ({ replace }));
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiUrl: 'http://api.test', siteUrl: 'http://app.test' } }));
  vi.stubGlobal('useToast', () => ({ add: (toast: { color: string; description: string; title: string }) => toasts.push(toast) }));
  vi.stubGlobal('useLtAuthClient', () => ({ sendVerificationEmail, verifyEmail }));
  // As nuxt-extensions: the API's message from the response body wins over the thrown message.
  vi.stubGlobal('useLtErrorTranslation', () => ({
    translateError: (err: unknown) => {
      const body = typeof err === 'object' && err !== null ? (err as { data?: { message?: string } }).data?.message : undefined;
      const message = body ?? (err instanceof Error ? err.message : String(err));
      return message.startsWith('#LTNS_0020') ? RATE_LIMIT_DE : message;
    },
  }));
  vi.stubGlobal('$fetch', fetch);
  vi.stubGlobal('appUrl', (path: string, origin: string) => `${origin}${path}`);
  vi.stubGlobal('safeRedirectTarget', (target: string) => target);
  vi.stubGlobal('verifyEmailState', verifyEmailState);
  vi.stubGlobal('recallVerifyEmail', recallVerifyEmail);

  const app = createApp(VerifyEmailPage);
  const slotted = (tag: string) =>
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h(tag, slots.default?.()),
    });
  app.component('UPageCard', slotted('section'));
  app.component('UIcon', defineComponent({ render: () => null }));
  app.component(
    'UAlert',
    defineComponent({
      props: { title: { default: undefined, type: String } },
      setup:
        (props, { slots }) =>
        () =>
          h('div', [props.title, slots.description?.()]),
    }),
  );
  app.component(
    'UButton',
    defineComponent({
      props: { disabled: Boolean, to: { default: undefined, type: [String, Object] }, type: { default: 'button', type: String } },
      setup:
        (props, { slots }) =>
        () =>
          props.to ? h('a', slots.default?.()) : h('button', { disabled: props.disabled, type: props.type }, slots.default?.()),
    }),
  );
  app.component(
    'UFormField',
    defineComponent({
      props: { label: { required: true, type: String } },
      setup:
        (props, { slots }) =>
        () =>
          h('label', [props.label, slots.default?.()]),
    }),
  );
  app.component(
    'UInput',
    defineComponent({
      emits: ['update:modelValue'],
      props: { modelValue: { default: '', type: String } },
      setup:
        (props, { emit }) =>
        () =>
          h('input', { onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value), value: props.modelValue }),
    }),
  );
  app.component(
    'UForm',
    defineComponent({
      emits: ['submit'],
      props: {
        schema: { required: true, type: Object as PropType<v.GenericSchema> },
        state: { required: true, type: Object as PropType<Record<string, string>> },
      },
      setup(props, { emit, slots }) {
        forms.push(async (data) => {
          Object.assign(props.state, data);
          const result = v.safeParse(props.schema, props.state);
          if (!result.success) {
            return result.issues.map((issue) => issue.message);
          }
          emit('submit', { data: result.output });
          await settle();
          return [];
        });
        return () => h('form', { 'data-form': '' }, slots.default?.());
      },
    }),
  );
  app.config.errorHandler = (err) => errors.push(err);

  const root = document.createElement('div');
  app.mount(root);
  await settle();

  /** The button whose label starts with `label`. */
  const button = (label: string) => [...root.querySelectorAll('button')].find((element) => element.textContent?.trim().startsWith(label));

  return {
    button,
    clickResend: async () => {
      button('Neue E-Mail senden')?.click();
      await settle();
    },
    errors,
    fetch,
    form: () => (root.querySelector('[data-form]') ? forms.at(-1) : undefined),
    memory: () => recallVerifyEmail(window.history.state),
    resendRequests: () => fetch.mock.calls.filter(([url]) => url === RESEND),
    route,
    sendVerificationEmail,
    text: () => root.textContent ?? '',
    toasts,
    unmount: () => app.unmount(),
    verifyEmail,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '');
});

const REFUSED = { error: { message: 'Token expired', status: 401 } };
const BY_TOKEN = { resendVerificationByToken: true };

describe('verify-email against nest-server 12.6.0+ (the API takes the token)', () => {
  it('asks for a new mail with the refused token alone and shows the address the API masked', async () => {
    const page = await mountPage({ features: BY_TOKEN, query: { token: SEALED }, verify: REFUSED });

    expect(page.errors).toEqual([]);
    expect(page.text()).toContain('Verifizierung fehlgeschlagen');
    expect(page.route.query).toEqual({});

    await page.clickResend();

    expect(page.resendRequests()).toEqual([[RESEND, { body: { token: SEALED }, method: 'POST' }]]);
    expect(page.sendVerificationEmail).not.toHaveBeenCalled();
    expect(page.text()).toContain('m***@test.com');
    expect(page.toasts.at(-1)).toMatchObject({ color: 'success', title: 'E-Mail gesendet' });
    // The answer is the same for an account that is verified already, so the page promises nothing.
    expect(page.toasts.at(-1)?.description).toContain('Falls dein Konto noch nicht bestätigt ist');
    expect(page.button('Neue E-Mail senden (60s)')?.disabled).toBe(true);
    page.unmount();
  });

  it('keeps the refused token in the history entry, and a reload offers the new mail without asking again', async () => {
    const first = await mountPage({ features: BY_TOKEN, query: { token: SEALED }, verify: REFUSED });
    expect(first.memory()).toEqual({ deadToken: SEALED, email: '', verified: false });
    const state = window.history.state as Record<string, unknown>;
    first.unmount();

    const reloaded = await mountPage({ features: BY_TOKEN, state });

    expect(reloaded.verifyEmail).not.toHaveBeenCalled();
    expect(reloaded.text()).toContain('Verifizierung fehlgeschlagen');
    await reloaded.clickResend();
    expect(reloaded.resendRequests()).toEqual([[RESEND, { body: { token: SEALED }, method: 'POST' }]]);
    reloaded.unmount();
  });

  it('asks for the address when the API cannot read the token, forgets the token, and keeps the typed address to the form', async () => {
    const page = await mountPage({ features: BY_TOKEN, query: { token: GARBLED }, resend: () => ({ email: null, success: true }), verify: REFUSED });
    expect(page.memory().deadToken).toBe(GARBLED);

    await page.clickResend();

    expect(page.toasts.at(-1)).toMatchObject({ color: 'error', title: 'Link nicht erkannt' });
    expect(page.memory().deadToken).toBe('');
    const submit = page.form();
    expect(submit).toBeDefined();
    expect((await submit!({ email: 'not-an-address' }))[0]).toBe('Bitte gib eine gültige E-Mail-Adresse ein.');
    expect(await submit!({ email: ' max@test.com ' })).toEqual([]);
    expect(page.sendVerificationEmail).toHaveBeenCalledWith({ callbackURL: 'http://app.test/auth/verify-email', email: 'max@test.com' });
    // The typed address goes neither into the URL nor into the history entry.
    expect(page.route.query).toEqual({});
    expect(JSON.stringify(window.history.state)).not.toContain('max@test.com');
    expect(page.form()).toBeDefined();
    page.unmount();
  });

  it('shows only the address the API masked, never one read from the token', async () => {
    // A readable token names the address in full; the page must not show it, or anything built from it.
    const page = await mountPage({ features: BY_TOKEN, query: { token: READABLE }, resend: () => ({ email: 'x***@example.org', success: true }), verify: REFUSED });

    await page.clickResend();

    expect(page.text()).toContain('x***@example.org');
    expect(page.text()).not.toContain('max@test.com');
    expect(page.text()).not.toContain('m***@test.com');
    page.unmount();
  });

  it('asks for a new mail with a readable token too, but keeps it out of the history entry', async () => {
    const page = await mountPage({ features: BY_TOKEN, query: { token: READABLE }, verify: REFUSED });

    expect(JSON.stringify(window.history.state)).not.toContain(READABLE);
    expect(page.memory().deadToken).toBe('');
    await page.clickResend();
    expect(page.resendRequests()).toEqual([[RESEND, { body: { token: READABLE }, method: 'POST' }]]);
    page.unmount();
  });

  it('shows the translated 429 when the link has asked too often', async () => {
    const page = await mountPage({
      features: BY_TOKEN,
      query: { token: SEALED },
      resend: () => {
        throw fetchError(429, '#LTNS_0020: Too many requests');
      },
      verify: REFUSED,
    });

    await page.clickResend();

    expect(page.toasts.at(-1)).toEqual({ color: 'error', description: RATE_LIMIT_DE, title: 'Fehler' });
    expect(page.memory().deadToken).toBe(SEALED);
    page.unmount();
  });

  it('shows no transport line when the request does not reach the API', async () => {
    const page = await mountPage({
      features: BY_TOKEN,
      query: { token: SEALED },
      resend: () => {
        throw new Error(`[POST] "${RESEND}": <no response> Failed to fetch`);
      },
      verify: REFUSED,
    });

    await page.clickResend();

    expect(page.toasts.at(-1)?.description).toBe('Die E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.');
    page.unmount();
  });

  it('keeps no token when the API failed rather than refused the link', async () => {
    const page = await mountPage({ features: BY_TOKEN, query: { token: SEALED }, verify: { error: { message: 'Internal Server Error', status: 500 } } });

    expect(page.memory().deadToken).toBe('');
    expect(page.form()).toBeDefined();
    page.unmount();
  });

  it('remembers an accepted link, and no token', async () => {
    const page = await mountPage({ features: BY_TOKEN, query: { token: SEALED } });

    expect(page.text()).toContain('E-Mail bestätigt');
    expect(page.memory()).toEqual({ deadToken: '', email: '', verified: true });
    page.unmount();
  });
});

describe('verify-email against a server before 12.6.0 (no resend by token)', () => {
  // As 2.37.0 against nest-server 12.5: the address of the link or of login and sign-up, Better
  // Auth's own resend, no request to the new endpoint, no token in the history entry.
  it.each([
    ['a sealed token', SEALED],
    ['a readable token', READABLE],
  ])('sends the new mail to the address of the link with %s, as before, and keeps no token', async (_label, linkToken) => {
    const page = await mountPage({ query: { email: 'max@test.com', token: linkToken }, verify: REFUSED });

    expect(page.route.query).toEqual({});
    expect(page.memory()).toEqual({ deadToken: '', email: 'max@test.com', verified: false });
    expect(page.form()).toBeUndefined();
    await page.clickResend();

    expect(page.resendRequests()).toEqual([]);
    expect(page.sendVerificationEmail).toHaveBeenCalledWith({ callbackURL: 'http://app.test/auth/verify-email', email: 'max@test.com' });
    expect(page.toasts.at(-1)).toMatchObject({ color: 'success', description: 'Eine neue Bestätigungs-E-Mail wurde gesendet.' });
    page.unmount();
  });

  it('offers the resend to the address login or sign-up handed over, as before', async () => {
    const page = await mountPage({ query: { fromRegister: 'true' }, state: verifyEmailState('max@test.com') });

    expect(page.text()).toContain('max@test.com');
    expect(page.button('Bestätigungs-E-Mail erneut senden (60s)')?.disabled).toBe(true);
    expect(page.form()).toBeUndefined();
    expect(page.resendRequests()).toEqual([]);
    page.unmount();
  });

  it('falls back to the address when the features cannot be read', async () => {
    const page = await mountPage({ features: null, query: { token: SEALED }, verify: REFUSED });

    expect(page.memory().deadToken).toBe('');
    expect(page.form()).toBeDefined();
    page.unmount();
  });
});

describe('verify-email without a link', () => {
  it('offers the resend to the address login or sign-up handed over', async () => {
    const page = await mountPage({ features: BY_TOKEN, state: verifyEmailState('max@test.com') });

    expect(page.text()).toContain('max@test.com');
    expect(page.form()).toBeUndefined();
    page.button('Bestätigungs-E-Mail erneut senden')?.click();
    await settle();
    expect(page.sendVerificationEmail).toHaveBeenCalledWith({ callbackURL: 'http://app.test/auth/verify-email', email: 'max@test.com' });
    page.unmount();
  });

  it('asks for the address when it knows none', async () => {
    const page = await mountPage({ features: BY_TOKEN });

    expect(page.form()).toBeDefined();
    // UFormField shows the first message of a field.
    expect((await page.form()!({ email: '' }))[0]).toBe('Bitte gib deine E-Mail-Adresse ein.');
    page.unmount();
  });
});
