/**
 * Mounts the real app/pages/auth/setup.vue in every state the setup status can put it in.
 *
 * WHAT IT PINS
 *
 * Since nest-server 12.4.0, `POST /system-setup/init` is closed outside `local`, `ci` and `e2e`
 * unless `systemSetup.httpInit` opens it, and `GET /system-setup/status` says so
 * (`httpInitEnabled`, `httpInitTokenRequired`). The page shows the form only while the API takes
 * the first admin over HTTP: with the init closed the form would fail with 403 on every submit,
 * so it shows how to set the system up through the configuration instead. A token the API asks
 * for gets its own field, and a refused submit shows the backend's message from the response
 * body, not the transport line `[POST] "…": 403 Forbidden` that `err.message` carries.
 *
 * The round trip against a real API, open and closed, is `tests/e2e/system-setup.spec.ts`. The
 * token case would need a third API start there, so it is pinned here; sending the token as the
 * `X-System-Setup-Token` header is nuxt-extensions' part and tested there.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the page relies on are provided
 * as globals, `useSystemSetup` is a fake with the contract of nuxt-extensions 1.25.0 (`null` until
 * the status is read; after a 403, `initSetup` has re-read the status before it rethrows), and the
 * Nuxt UI components are stubs that render what the assertions read. The UAuthForm stub validates
 * with the page's own schema before it emits `submit`, as UAuthForm does.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, ref, type PropType } from 'vue';

import SetupPage from '../../../app/pages/auth/setup.vue';

interface Status {
  httpInitEnabled: boolean | null;
  httpInitTokenRequired: boolean | null;
  needsSetup: boolean | null;
}

interface FormStub {
  fields: Array<{ name: string; required?: boolean; type?: string }>;
  submit: (data: Record<string, string>) => Promise<string[]>;
}

const OPEN: Status = { httpInitEnabled: true, httpInitTokenRequired: false, needsSetup: true };
const CLOSED: Status = { httpInitEnabled: false, httpInitTokenRequired: false, needsSetup: true };
const ADMIN = { confirmPassword: 'Passw0rd!long', email: 'admin@test.com', name: 'Erster Admin', password: 'Passw0rd!long' };

/** An ofetch `FetchError`: the transport line in `message`, the backend's message in `data`. */
function fetchError(code: string): Error {
  return Object.assign(new Error(`[POST] "http://localhost:3000/system-setup/init": 403 Forbidden`), {
    data: { message: `#${code}: Refused`, statusCode: 403 },
  });
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await nextTick();
}

async function mountPage(initial: Status, initSetup: (params: Record<string, unknown>, status: { value: Status }) => Promise<void> = async () => {}) {
  const status = ref<Status>({ ...initial });
  const toasts: Array<{ color: string; description: string }> = [];
  const errors: unknown[] = [];
  const forms: FormStub[] = [];
  const init = vi.fn(async (params: Record<string, unknown>) => initSetup(params, status));
  const navigateTo = vi.fn(async () => {});

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useToast', () => ({ add: (toast: { color: string; description: string }) => toasts.push(toast) }));
  // As nuxt-extensions: the backend message from the response body wins over the thrown message.
  vi.stubGlobal('useLtErrorTranslation', () => ({
    translateError: (err: unknown) => {
      const body = (err as { data?: { message?: string } }).data?.message;
      const message = body ?? (err instanceof Error ? err.message : String(err));
      return message.startsWith('#LTNS_0053') ? 'Ersteinrichtung gesperrt' : message.startsWith('#LTNS_0054') ? 'Setup-Token falsch' : message;
    },
  }));
  vi.stubGlobal('useSystemSetup', () => ({
    checkSetupStatus: vi.fn(async () => status.value.needsSetup === true),
    httpInitEnabled: computed(() => status.value.httpInitEnabled),
    httpInitTokenRequired: computed(() => status.value.httpInitTokenRequired),
    initSetup: init,
    needsSetup: computed(() => status.value.needsSetup),
  }));

  const app = createApp(SetupPage);
  app.component(
    'UPageCard',
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('section', slots.default?.()),
    }),
  );
  app.component(
    'UAuthForm',
    defineComponent({
      emits: ['submit'],
      props: {
        fields: { required: true, type: Array as PropType<FormStub['fields']> },
        schema: { required: true, type: Object as PropType<v.GenericSchema> },
      },
      setup(props, { emit, slots }) {
        forms.push({
          get fields() {
            return props.fields;
          },
          async submit(data) {
            const result = v.safeParse(props.schema, data);
            if (!result.success) {
              return result.issues.map((issue) => issue.message);
            }
            emit('submit', { data: result.output });
            await settle();
            return [];
          },
        });
        return () => h('form', { 'data-form': '' }, [slots.title?.(), slots.description?.(), slots.footer?.()]);
      },
    }),
  );
  app.component(
    'UAlert',
    defineComponent({
      props: { color: { default: undefined, type: String }, title: { default: undefined, type: String } },
      setup:
        (props, { slots }) =>
        () =>
          h('div', { 'data-alert': props.color }, [props.title, slots.description?.()]),
    }),
  );
  app.component(
    'ULink',
    defineComponent({
      props: { to: { required: true, type: String } },
      setup:
        (props, { slots }) =>
        () =>
          h('a', { href: props.to }, slots.default?.()),
    }),
  );
  app.component('UIcon', defineComponent({ render: () => null }));
  app.config.errorHandler = (err) => errors.push(err);

  const root = document.createElement('div');
  app.mount(root);
  await settle();

  return {
    errors,
    form: () => (root.querySelector('[data-form]') ? forms.at(-1) : undefined),
    init,
    navigateTo,
    root,
    status,
    text: () => root.textContent ?? '',
    toasts,
    unmount: () => app.unmount(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('setup page', () => {
  it('shows the form while the API takes the first admin over HTTP, without a token field', async () => {
    const page = await mountPage(OPEN);

    expect(page.errors).toEqual([]);
    expect(page.form()?.fields.map((field) => field.name)).toEqual(['name', 'email', 'password', 'confirmPassword']);
    expect(page.text()).not.toContain('NSC__SYSTEM_SETUP__INITIAL_ADMIN__EMAIL');
    page.unmount();
  });

  it('shows how to set the system up through the configuration while the HTTP init is closed, and links to the login', async () => {
    const page = await mountPage(CLOSED);

    expect(page.errors).toEqual([]);
    expect(page.form()).toBeUndefined();
    for (const variable of [
      'NSC__SYSTEM_SETUP__INITIAL_ADMIN__EMAIL',
      'NSC__SYSTEM_SETUP__INITIAL_ADMIN__PASSWORD',
      'NSC__SYSTEM_SETUP__INITIAL_ADMIN__NAME',
      'NSC__SYSTEM_SETUP__HTTP_INIT__TOKEN',
    ]) {
      expect(page.text()).toContain(variable);
    }
    expect(page.root.querySelector('a[href="/auth/login"]')).not.toBeNull();
    page.unmount();
  });

  it('shows neither form nor hint while the status is unknown', async () => {
    const page = await mountPage({ httpInitEnabled: null, httpInitTokenRequired: null, needsSetup: null });

    expect(page.form()).toBeUndefined();
    expect(page.text()).not.toContain('NSC__SYSTEM_SETUP__INITIAL_ADMIN__EMAIL');
    expect(page.text()).toContain('Einrichtungsstatus wird geprüft');
    page.unmount();
  });

  it('says the system is set up, and links to the login, once no setup is needed', async () => {
    const page = await mountPage({ httpInitEnabled: true, httpInitTokenRequired: false, needsSetup: false });

    expect(page.form()).toBeUndefined();
    expect(page.text()).toContain('bereits eingerichtet');
    expect(page.root.querySelector('a[href="/auth/login"]')).not.toBeNull();
    page.unmount();
  });

  it('creates the admin, confirms it and goes to the login', async () => {
    const page = await mountPage(OPEN);

    expect(await page.form()!.submit(ADMIN)).toEqual([]);

    expect(page.init).toHaveBeenCalledExactlyOnceWith({ email: ADMIN.email, name: ADMIN.name, password: ADMIN.password, token: undefined });
    expect(page.toasts).toEqual([expect.objectContaining({ color: 'success' })]);
    expect(page.navigateTo).toHaveBeenCalledWith('/auth/login');
    page.unmount();
  });

  it('asks for the setup token when the API requires one, and hands it to initSetup', async () => {
    const page = await mountPage({ ...OPEN, httpInitTokenRequired: true });
    const token = page.form()!.fields.find((field) => field.name === 'token');

    expect(token).toMatchObject({ required: true, type: 'password' });
    expect(await page.form()!.submit(ADMIN)).toEqual(['Setup-Token ist erforderlich']);
    expect(page.init).not.toHaveBeenCalled();

    expect(await page.form()!.submit({ ...ADMIN, token: 'setup-token-with-letters' })).toEqual([]);
    expect(page.init).toHaveBeenCalledWith(expect.objectContaining({ token: 'setup-token-with-letters' }));
    page.unmount();
  });

  it('shows the backend message of a refused submit, not the transport line', async () => {
    const page = await mountPage({ ...OPEN, httpInitTokenRequired: true }, async () => {
      throw fetchError('LTNS_0054');
    });

    await page.form()!.submit({ ...ADMIN, token: 'wrong-setup-token-x' });

    expect(page.toasts).toEqual([expect.objectContaining({ color: 'error', description: 'Setup-Token falsch' })]);
    expect(page.navigateTo).not.toHaveBeenCalled();
    page.unmount();
  });

  it('switches to the hint when the API closed the HTTP init in the meantime', async () => {
    // As nuxt-extensions 1.25.0: after a 403, initSetup has re-read the status before it rethrows.
    const page = await mountPage(OPEN, async (_params, status) => {
      status.value = { ...CLOSED };
      throw fetchError('LTNS_0053');
    });

    await page.form()!.submit(ADMIN);

    expect(page.toasts).toEqual([expect.objectContaining({ color: 'error', description: 'Ersteinrichtung gesperrt' })]);
    expect(page.form()).toBeUndefined();
    expect(page.text()).toContain('NSC__SYSTEM_SETUP__INITIAL_ADMIN__EMAIL');
    page.unmount();
  });
});
