/**
 * Mounts the real app/pages/app/settings/security.vue with the answers `/iam/features` can give.
 *
 * WHAT IT PINS
 *
 * The page offers two-factor authentication and passkeys only while the API supports them. nest-server
 * 12.11.0+ reports `twoFactor: false` and `passkey: false` when the plugin is off, by default for an API
 * that signs in through providers alone (`emailAndPassword: false`). The endpoints answer 404 there, so a
 * section shown anyway fails on every click ("2FA aktivieren", "Passkey hinzufügen"), and loading the
 * passkey list logs an error on every visit. Only an explicit `false` hides a section: an older API that
 * reports neither field keeps both. With neither factor left, the page says why instead of showing the
 * account card alone.
 *
 * The provider-only case cannot run against a real API in E2E: nobody can sign in there without a real
 * provider round trip. The page with both factors on is walked by `tests/e2e/auth-comprehensive.spec.ts`.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the page relies on are provided as
 * globals, and the Nuxt UI components by stubs that render what the assertions read. The page awaits the
 * features during SSR (`import.meta.server`, never true here), which makes its setup asynchronous: as in
 * Nuxt, it renders inside <Suspense>.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, onMounted, reactive, ref, Suspense, type Component } from 'vue';

import SecurityPage from '~/pages/app/settings/security.vue';

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

async function mountPage(features: Record<string, unknown>) {
  const errors: unknown[] = [];
  const listUserPasskeys = vi.fn(async () => ({ data: [], error: null }));

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
  vi.stubGlobal('useOverlay', () => ({ create: vi.fn() }));
  vi.stubGlobal('useLtErrorTranslation', () => ({ translateError: (message: string) => message }));
  vi.stubGlobal('useLtAuth', () => ({
    features: ref(features),
    fetchFeatures: vi.fn(async () => {}),
    is2FAEnabled: computed(() => false),
    registerPasskey: vi.fn(),
    setUser: vi.fn(),
    user: ref({ email: 'user@test.com', emailVerified: true, name: 'User' }),
  }));
  vi.stubGlobal('useLtAuthClient', () => ({ passkey: { deletePasskey: vi.fn(), listUserPasskeys }, twoFactor: {} }));

  const passthrough = (tag: string) =>
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h(tag, [slots.header?.(), slots.default?.()]),
    });
  const suspended = defineComponent({ render: () => h(Suspense, null, { default: () => h(SecurityPage as Component) }) });
  const app = createApp(suspended);
  app.component('UCard', passthrough('section'));
  app.component('UForm', passthrough('form'));
  app.component('UFormField', passthrough('div'));
  app.component('UBadge', passthrough('span'));
  app.component('UButton', passthrough('button'));
  app.component('UInput', defineComponent({ render: () => h('input') }));
  app.component('UIcon', defineComponent({ render: () => null }));
  app.component(
    'UAlert',
    defineComponent({
      props: { description: { default: undefined, type: String }, title: { default: undefined, type: String } },
      setup: (props) => () => h('div', { 'data-alert': '' }, [props.title, ' ', props.description]),
    }),
  );
  app.config.errorHandler = (err) => errors.push(err);

  const root = document.createElement('div');
  app.mount(root);
  await settle();

  const headings = (): string[] => [...root.querySelectorAll('h2')].map((el) => el.textContent?.trim() ?? '');
  return {
    alert: () => root.querySelector('[data-alert]')?.textContent ?? null,
    errors,
    headings,
    listUserPasskeys,
    text: () => root.textContent ?? '',
    unmount: () => app.unmount(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('security settings follow /iam/features', () => {
  it('offers two-factor authentication and passkeys while the API supports both', async () => {
    const page = await mountPage({ emailAndPassword: true, passkey: true, twoFactor: true });

    expect(page.headings()).toEqual(['Zwei-Faktor-Authentifizierung', 'Passkeys', 'Kontoinformationen']);
    expect(page.text()).toContain('2FA aktivieren');
    expect(page.text()).toContain('Passkey hinzufügen');
    expect(page.alert()).toBeNull();
    expect(page.listUserPasskeys).toHaveBeenCalledTimes(1);
    expect(page.errors).toEqual([]);
    page.unmount();
  });

  it('keeps both sections for an API that reports neither field', async () => {
    const page = await mountPage({});

    expect(page.headings()).toEqual(['Zwei-Faktor-Authentifizierung', 'Passkeys', 'Kontoinformationen']);
    expect(page.listUserPasskeys).toHaveBeenCalledTimes(1);
    page.unmount();
  });

  it('leaves out what the API reports off, and does not ask for passkeys it does not keep', async () => {
    const noPasskeys = await mountPage({ passkey: false, twoFactor: true });
    expect(noPasskeys.headings()).toEqual(['Zwei-Faktor-Authentifizierung', 'Kontoinformationen']);
    expect(noPasskeys.text()).not.toContain('Passkey hinzufügen');
    expect(noPasskeys.listUserPasskeys).not.toHaveBeenCalled();
    expect(noPasskeys.alert()).toBeNull();
    noPasskeys.unmount();

    const noTwoFactor = await mountPage({ passkey: true, twoFactor: false });
    expect(noTwoFactor.headings()).toEqual(['Passkeys', 'Kontoinformationen']);
    expect(noTwoFactor.text()).not.toContain('2FA aktivieren');
    expect(noTwoFactor.alert()).toBeNull();
    noTwoFactor.unmount();
  });

  it('says where the factors live when the API signs in through providers alone', async () => {
    // nest-server 12.11.0+ with `betterAuth.emailAndPassword.enabled: false`.
    const page = await mountPage({ emailAndPassword: false, passkey: false, socialProviders: ['github'], twoFactor: false });

    expect(page.headings()).toEqual(['Kontoinformationen']);
    expect(page.text()).not.toContain('2FA aktivieren');
    expect(page.text()).not.toContain('Passkey hinzufügen');
    expect(page.alert()).toContain('Keine weiteren Anmeldefaktoren');
    expect(page.alert()).toContain('in deinem Konto bei diesem Anbieter');
    expect(page.listUserPasskeys).not.toHaveBeenCalled();
    expect(page.errors).toEqual([]);
    page.unmount();
  });

  it('says the factors are not set up when an API with a password has both off', async () => {
    const page = await mountPage({ emailAndPassword: true, passkey: false, twoFactor: false });

    expect(page.headings()).toEqual(['Kontoinformationen']);
    expect(page.alert()).toContain('Zwei-Faktor-Authentifizierung und Passkeys sind für diese Anwendung nicht eingerichtet.');
    page.unmount();
  });
});
