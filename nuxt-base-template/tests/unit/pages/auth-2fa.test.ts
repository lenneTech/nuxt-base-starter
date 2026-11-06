/**
 * Mounts the real app/pages/auth/2fa.vue and pins what it does with the session token.
 *
 * WHAT IT PINS
 *
 * nest-server answers the second factor (`verifyTotp`, `verifyBackupCode`) with
 * `{ token, user }`, and `getSession()` carries a `token` too. That token is Better Auth's opaque
 * session token: the credential the httpOnly session cookie exists to keep away from scripts. The
 * page used to store it in `jwtToken`, which nuxt-extensions keeps in the cookie `lt-jwt-token`,
 * readable by any script on the page for seven days. So in the default cookie mode one XSS was
 * enough to take over the session.
 *
 * The page takes a token only when it is a JWT, the same test as `isJwtShaped` in nest-server.
 * An opaque token is never stored: the page signs the user in on the session cookie
 * (`setUser(user, 'cookie')`) and asks `/iam/token` for a JWT (`switchToJwtMode()`). In the JWT
 * mode (`cookies: false`) the API answers with a JWT, and the page signs in with it. A session
 * token stored by an earlier version is removed; a real JWT stays.
 *
 * The round trip against a real API is step 5 of `tests/e2e/auth-lifecycle.spec.ts`.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the page relies on are provided
 * as globals, the auth composables are fakes, and the Nuxt UI components are stubs that render what
 * the assertions read. The UForm stub validates with the page's own schema before it emits `submit`.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, reactive, ref, type PropType } from 'vue';

import TwoFactorPage from '~/pages/auth/2fa.vue';

/** Better Auth's opaque session token, as nest-server 12.6.0 puts it into the 2FA answer. */
const SESSION_TOKEN = 'Xq3RkV8mT2pLw9sJ4nYc7bDf1gHa6eZu';
/** A JWT from `/iam/token`: the only thing `lt-jwt-token` may hold. */
const JWT = 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl';
const USER = { email: 'max@test.com', id: 'u1', name: 'Max' };

interface Options {
  /** `lt-jwt-token` before the submit. */
  cookie?: null | string;
  /** What `getSession()` answers. */
  session?: unknown;
  /** What `verifyTotp` / `verifyBackupCode` answer. */
  verify?: unknown;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

async function mountPage(options: Options = {}) {
  const jwtToken = ref<null | string>(options.cookie ?? null);
  const setUser = vi.fn();
  const switchToJwtMode = vi.fn(async () => true);
  const verifyTotp = vi.fn(async () => options.verify ?? { data: { token: SESSION_TOKEN, user: USER } });
  const verifyBackupCode = vi.fn(async () => options.verify ?? { data: { token: SESSION_TOKEN, user: USER } });
  const getSession = vi.fn(async () => options.session ?? { data: null });
  const navigateTo = vi.fn(async () => {});
  const toasts: Array<{ color: string; title: string }> = [];
  const submits: Array<(data: Record<string, string>) => Promise<void>> = [];

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useRoute', () => ({ query: {} }));
  vi.stubGlobal('safeRedirectTarget', () => '/app');
  vi.stubGlobal('useToast', () => ({ add: (toast: { color: string; title: string }) => toasts.push(toast) }));
  vi.stubGlobal('useLtErrorTranslation', () => ({ translateError: (message: string) => message }));
  vi.stubGlobal('useLtAuth', () => ({ jwtToken, setUser, switchToJwtMode }));
  vi.stubGlobal('useLtAuthClient', () => ({ getSession, twoFactor: { verifyBackupCode, verifyTotp } }));

  const app = createApp(TwoFactorPage);
  const slotted = (tag: string) =>
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h(tag, slots.default?.()),
    });
  app.component('UPageCard', slotted('section'));
  app.component('UFormField', slotted('label'));
  app.component('UIcon', defineComponent({ render: () => null }));
  app.component('UInput', defineComponent({ render: () => h('input') }));
  app.component('ULink', slotted('a'));
  app.component(
    'UButton',
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
  );
  app.component(
    'UForm',
    defineComponent({
      emits: ['submit'],
      props: { schema: { required: true, type: Object as PropType<v.GenericSchema> } },
      setup(props, { emit, slots }) {
        submits.push(async (data) => {
          const result = v.safeParse(props.schema, data);
          if (result.success) {
            emit('submit', { data: result.output });
          }
          await settle();
        });
        return () => h('form', slots.default?.());
      },
    }),
  );

  const root = document.createElement('div');
  app.mount(root);
  await settle();

  return {
    getSession,
    jwtToken,
    navigateTo,
    root,
    setUser,
    submit: (code = '123456') => submits.at(-1)!({ code }),
    switchToJwtMode,
    toasts,
    unmount: () => app.unmount(),
    verifyBackupCode,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('2fa page and the session token', () => {
  it.each([
    ['under `data`', { data: { token: SESSION_TOKEN, user: USER } }],
    ['at the top level', { token: SESSION_TOKEN, user: USER }],
  ])('never stores the token of a TOTP answer %s, and signs in on the session cookie', async (_label, verify) => {
    const page = await mountPage({ verify });

    await page.submit();

    expect(page.jwtToken.value).not.toBe(SESSION_TOKEN);
    expect(page.setUser).toHaveBeenCalledWith(USER, 'cookie');
    expect(page.setUser).not.toHaveBeenCalledWith(expect.anything(), 'jwt');
    expect(page.switchToJwtMode).toHaveBeenCalled();
    expect(page.navigateTo).toHaveBeenCalledWith('/app');
    page.unmount();
  });

  it('never stores the token of a backup-code answer', async () => {
    const page = await mountPage();
    page.root.querySelectorAll('button').forEach((button) => {
      if (button.textContent?.includes('Backup-Code verwenden')) button.click();
    });
    await settle();

    await page.submit('backup-code-1');

    expect(page.verifyBackupCode).toHaveBeenCalled();
    expect(page.jwtToken.value).not.toBe(SESSION_TOKEN);
    expect(page.setUser).toHaveBeenCalledWith(USER, 'cookie');
    page.unmount();
  });

  it('never stores the session token from the getSession fallback', async () => {
    const page = await mountPage({ session: { data: { session: { token: SESSION_TOKEN }, token: SESSION_TOKEN, user: USER } }, verify: { data: {} } });

    await page.submit();

    expect(page.getSession).toHaveBeenCalled();
    expect(page.jwtToken.value).not.toBe(SESSION_TOKEN);
    expect(page.setUser).toHaveBeenCalledWith(USER, 'cookie');
    expect(page.switchToJwtMode).toHaveBeenCalled();
    page.unmount();
  });

  it.each([
    ['under `data`', { data: { token: JWT, user: USER } }],
    ['at the top level', { token: JWT, user: USER }],
  ])('signs in with a JWT the answer carries %s (JWT mode)', async (_label, verify) => {
    const page = await mountPage({ verify });

    await page.submit();

    expect(page.jwtToken.value).toBe(JWT);
    expect(page.setUser).toHaveBeenCalledWith(USER, 'jwt');
    expect(page.switchToJwtMode).not.toHaveBeenCalled();
    page.unmount();
  });

  it('signs in with a JWT from the getSession fallback', async () => {
    const page = await mountPage({ session: { data: { token: JWT, user: USER } }, verify: { data: {} } });

    await page.submit();

    expect(page.jwtToken.value).toBe(JWT);
    expect(page.setUser).toHaveBeenCalledWith(USER, 'jwt');
    page.unmount();
  });

  it.each([
    ['a token with three parts but no JSON header', 'abc.def.ghi'],
    ['a signed cookie value', `${SESSION_TOKEN}.c2lnbmF0dXJl`],
  ])('never stores %s', async (_label, token) => {
    const page = await mountPage({ verify: { data: { token, user: USER } } });

    await page.submit();

    expect(page.jwtToken.value).toBeNull();
    expect(page.setUser).toHaveBeenCalledWith(USER, 'cookie');
    page.unmount();
  });

  it('removes a session token an earlier version stored, and keeps a real JWT', async () => {
    const leaked = await mountPage({ cookie: SESSION_TOKEN });
    await leaked.submit();
    expect(leaked.jwtToken.value).toBeNull();
    leaked.unmount();

    const jwt = await mountPage({ cookie: JWT });
    await jwt.submit();
    expect(jwt.jwtToken.value).toBe(JWT);
    jwt.unmount();
  });

  it('signs nobody in when the code is refused', async () => {
    const page = await mountPage({ verify: { error: { message: 'Invalid code' } } });

    await page.submit();

    expect(page.setUser).not.toHaveBeenCalled();
    expect(page.jwtToken.value).toBeNull();
    expect(page.toasts.at(-1)).toMatchObject({ color: 'error' });
    page.unmount();
  });
});
