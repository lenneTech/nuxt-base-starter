/**
 * Mounts the real app/pages/auth/2fa.vue and pins how it completes the second factor.
 *
 * WHAT IT PINS
 *
 * nest-server 12.6.0 answers the second factor with `{ token, user }`, and `token` is Better Auth's
 * opaque session token: the credential the httpOnly session cookie keeps away from scripts. Up to
 * 2.38.0 the page stored it in `jwtToken`, the script-readable cookie `lt-jwt-token`. 2.38.1 made the
 * page store only a JWT; 2.38.2 hands the whole sign-in to the helpers of nuxt-extensions 1.26.0,
 * `useLtAuth().twoFactor.verifyTotp` and `verifyBackupCode`, which apply that rule themselves (their
 * own tests are in nuxt-extensions). The page now only verifies the code and navigates: it gets no
 * `jwtToken`, no `setUser` and no raw client from `useLtAuth()`, so it cannot store a token at all.
 *
 * It also pins the error text: a message with an error code is translated, Better Auth's English
 * messages ("Invalid code") are replaced by the page's German text.
 *
 * The round trip against a real API is step 5 of `tests/e2e/auth-lifecycle.spec.ts`.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the page relies on are provided
 * as globals, `useLtAuth()` is a fake that offers only the two-factor helpers, and the Nuxt UI
 * components are stubs. The UForm stub validates with the page's own schema before it emits `submit`.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, reactive, ref, type PropType } from 'vue';

import TwoFactorPage from '~/pages/auth/2fa.vue';
import { errorText } from '~/utils/error-text';

/** Better Auth's opaque session token, as nest-server 12.6.0 puts it into the 2FA answer. */
const SESSION_TOKEN = 'Xq3RkV8mT2pLw9sJ4nYc7bDf1gHa6eZu';
const USER = { email: 'max@test.com', id: 'u1', name: 'Max' };
const PASSWORD_WRONG_DE = 'Das Passwort ist falsch.';

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

async function mountPage(answer: unknown = { data: { token: SESSION_TOKEN, user: USER } }) {
  const verifyTotp = vi.fn(async () => answer);
  const verifyBackupCode = vi.fn(async () => answer);
  const navigateTo = vi.fn(async () => {});
  const toasts: Array<{ color: string; description: string; title: string }> = [];
  const submits: Array<(data: Record<string, string>) => Promise<void>> = [];

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useRoute', () => ({ query: {} }));
  vi.stubGlobal('safeRedirectTarget', () => '/app');
  vi.stubGlobal('errorText', errorText);
  vi.stubGlobal('useToast', () => ({ add: (toast: { color: string; description: string; title: string }) => toasts.push(toast) }));
  // As nuxt-extensions: a coded message comes back translated, anything else unchanged.
  vi.stubGlobal('useLtErrorTranslation', () => ({ translateError: (message: string) => (message.startsWith('#LTNS_0002:') ? PASSWORD_WRONG_DE : message) }));
  // Only the helpers: a page that reached for `jwtToken`, `setUser` or the raw client would fail here.
  vi.stubGlobal('useLtAuth', () => ({ twoFactor: { verifyBackupCode, verifyTotp } }));
  vi.stubGlobal('useLtAuthClient', () => {
    throw new Error('the 2FA page must verify through useLtAuth().twoFactor, not the raw client');
  });

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
  const errors: unknown[] = [];
  app.config.errorHandler = (err) => errors.push(err);

  const root = document.createElement('div');
  app.mount(root);
  await settle();

  return {
    errors,
    navigateTo,
    root,
    submit: (code = '123456') => submits.at(-1)!({ code }),
    toasts,
    unmount: () => app.unmount(),
    useBackupCode: async () => {
      root.querySelectorAll('button').forEach((button) => {
        if (button.textContent?.includes('Backup-Code verwenden')) button.click();
      });
      await settle();
    },
    verifyBackupCode,
    verifyTotp,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('2fa page completes the sign-in through the helpers', () => {
  it('verifies a TOTP code through useLtAuth().twoFactor and navigates, whatever token the answer carries', async () => {
    const page = await mountPage();

    await page.submit('123456');

    expect(page.errors).toEqual([]);
    expect(page.verifyTotp).toHaveBeenCalledWith({ code: '123456' });
    expect(page.navigateTo).toHaveBeenCalledWith('/app');
    page.unmount();
  });

  it('verifies a backup code through the backup-code helper', async () => {
    const page = await mountPage();
    await page.useBackupCode();

    await page.submit('backup-code-1');

    expect(page.errors).toEqual([]);
    expect(page.verifyBackupCode).toHaveBeenCalledWith({ code: 'backup-code-1' });
    expect(page.verifyTotp).not.toHaveBeenCalled();
    expect(page.navigateTo).toHaveBeenCalledWith('/app');
    page.unmount();
  });
});

describe('2fa page error texts', () => {
  it('shows German text for an English message of Better Auth, and stays on the page', async () => {
    const page = await mountPage({ error: { message: 'Invalid code' } });

    await page.submit();

    expect(page.toasts.at(-1)).toEqual({ color: 'error', description: 'Code ungültig', title: 'Bestätigung fehlgeschlagen' });
    expect(page.navigateTo).not.toHaveBeenCalled();
    page.unmount();
  });

  it('shows the backup-code text for a refused backup code', async () => {
    const page = await mountPage({ error: { message: 'Invalid backup code' } });
    await page.useBackupCode();

    await page.submit('backup-code-1');

    expect(page.toasts.at(-1)?.description).toBe('Backup-Code ungültig');
    page.unmount();
  });

  // Better Auth's refusals that are not a wrong code. They carry no `#…_0000:` marker, so a plain
  // fallback turned each into "Code ungültig", and the user retried a code that could never work.
  it.each([
    ['an expired challenge', 'INVALID_TWO_FACTOR_COOKIE', 'Invalid two factor cookie', 'abgelaufen', true],
    ['too many attempts on one challenge', 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', 'Too many attempts. Please request a new code.', 'Zu viele Versuche', true],
    ['a locked account', 'ACCOUNT_TEMPORARILY_LOCKED', 'Too many failed verification attempts. Your account is temporarily locked.', 'gesperrt', false],
  ])('says what happened for %s instead of "Code ungültig"', async (_label, code, message, says, restart) => {
    const page = await mountPage({ error: { code, message } });

    await page.submit();

    expect(page.toasts.at(-1)?.description).toContain(says);
    expect(page.toasts.at(-1)?.description).not.toBe('Code ungültig');
    if (restart) {
      expect(page.navigateTo).toHaveBeenCalledWith({ path: '/auth/login', query: { redirect: '/app' } });
    } else {
      expect(page.navigateTo).not.toHaveBeenCalled();
    }
    page.unmount();
  });

  it('translates a message with an error code', async () => {
    const page = await mountPage({ error: { message: '#LTNS_0002: Invalid password' } });

    await page.submit();

    expect(page.toasts.at(-1)?.description).toBe(PASSWORD_WRONG_DE);
    page.unmount();
  });
});
