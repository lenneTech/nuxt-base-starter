/**
 * Mounts the real app/pages/app/settings/ai.vue and drives its MCP confirmation switch.
 *
 * WHAT IT PINS
 *
 * The switch is the user's "bypass permissions" mode for MCP (nest-server 12.3.0, DEV-2653):
 * switched off, an MCP client runs destructive tools in the user's name without asking. So the
 * page has to show that state as a warning for as long as it lasts, show the switch locked when
 * the server enforces the value, never offer a switch it could not save, and report a refused
 * change in German rather than as the raw `#LTNS_0609` marker. The round trip against a real API
 * (stored, survives a reload) is `tests/e2e/ai-settings-mcp-confirmation.spec.ts`; the enforced
 * state needs a server started with `ai.mcp.confirmation.enforced`, so it is pinned here.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the page relies on are provided
 * as globals, `useLtAiSettings` is replaced by a fake with the contract of nuxt-extensions 1.22.0
 * (`update()` adopts the server's answer, or throws and keeps the old value), and the Nuxt UI
 * components by stubs that render what the assertions read.
 *
 * Except the switch: USwitch stands in as a thin wrapper around reka-ui's real `SwitchRoot`, which
 * USwitch renders with the `modelValue` it is given. That component decides once, at setup, whether
 * it is controlled: mounted with `modelValue` undefined, it keeps its own state and flips it on a
 * click whatever the parent does next. A hand-written controlled stub hid exactly that. The page
 * mounted the switch before the settings arrived, so after a refused change it showed a state the
 * server did not hold, e.g. "on" while MCP kept running destructive tools without asking.
 */
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, onMounted, ref, type Component } from 'vue';

import AiSettingsPage from '../../../app/pages/app/settings/ai.vue';

// reka-ui is a dependency of @nuxt/ui, not of the template, so it is loaded from next to @nuxt/ui
// (the copy USwitch actually renders), the way icon-endpoint-contract.test.ts loads @iconify/vue.
const rekaEntry = join(dirname(dirname(realpathSync('node_modules/@nuxt/ui'))), 'reka-ui', 'dist', 'index.js');
const { SwitchRoot } = (await import(pathToFileURL(rekaEntry).href)) as { SwitchRoot: Component };

interface Settings {
  mcpConfirmation: boolean;
  mcpConfirmationEnforced: boolean;
}

const ENFORCED_DE = 'Diese KI-Einstellung ist vom Server festgelegt und kann nicht geändert werden.';
const WARNING = 'Destruktive Aktionen werden über MCP ohne Rückfrage ausgeführt.';

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await nextTick();
}

async function mountPage(options: { initial?: null | Settings; loadError?: string; mcp?: boolean; refuse?: string } = {}) {
  const toasts: Array<{ color: string; description: string }> = [];
  const errors: unknown[] = [];
  const settings = ref<null | Settings>(null);
  const error = ref<null | string>(null);
  const loadSettings = vi.fn(async () => {
    if (options.loadError) {
      error.value = options.loadError;
      return;
    }
    settings.value = options.initial === undefined ? { mcpConfirmation: true, mcpConfirmationEnforced: false } : options.initial;
  });
  const update = vi.fn(async (input: { mcpConfirmation?: boolean }) => {
    if (options.refuse) {
      error.value = options.refuse;
      throw new Error(options.refuse);
    }
    settings.value = { ...settings.value!, ...input };
  });

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('useToast', () => ({ add: (toast: { color: string; description: string }) => toasts.push(toast) }));
  vi.stubGlobal('useLtErrorTranslation', () => ({
    translateError: (message: string) => (message.startsWith('#LTNS_0609') ? ENFORCED_DE : message),
  }));
  vi.stubGlobal('useLtAiConnections', () => ({
    connections: ref([]),
    load: vi.fn(async () => {}),
    locked: ref(false),
    select: vi.fn(),
    selected: computed(() => undefined),
  }));
  vi.stubGlobal('useLtAiUsage', () => ({ load: vi.fn(async () => {}), usage: ref(null) }));
  vi.stubGlobal('useLtAiSettings', () => ({
    enforced: computed(() => settings.value?.mcpConfirmationEnforced === true),
    error,
    load: loadSettings,
    loading: ref(false),
    settings,
    update,
  }));
  // As nuxt-extensions 1.23.0: the AI middleware has loaded the status before the page mounts.
  vi.stubGlobal('useLtAiStatus', () => ({ enabled: computed(() => true), mcp: computed(() => options.mcp ?? true) }));

  const app = createApp(AiSettingsPage);
  app.component(
    'UCard',
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('section', [slots.header?.(), slots.default?.()]),
    }),
  );
  app.component(
    'UAlert',
    defineComponent({
      props: { color: { default: undefined, type: String }, description: { default: undefined, type: String }, title: { default: undefined, type: String } },
      setup: (props) => () => h('div', { 'data-alert': props.color }, [props.title, props.description].filter(Boolean).join(' ')),
    }),
  );
  // As USwitch (@nuxt/ui 4.12.0, Switch.vue): `modelValue` declared with `type: null` and passed on
  // to SwitchRoot as given, undefined included; `disabled || loading` disables it.
  app.component(
    'USwitch',
    defineComponent({
      emits: ['update:modelValue'],
      props: {
        description: { default: undefined, type: String },
        disabled: { default: false, type: Boolean },
        label: { default: undefined, type: String },
        loading: { default: false, type: Boolean },
        modelValue: { default: undefined, type: null },
      },
      setup:
        (props, { emit }) =>
        () =>
          h(SwitchRoot, {
            'aria-label': props.label,
            disabled: props.disabled || props.loading,
            modelValue: props.modelValue,
            'onUpdate:modelValue': (value: boolean) => emit('update:modelValue', value),
          }),
    }),
  );
  for (const name of ['UBadge', 'UButton', 'UIcon', 'UProgress']) {
    app.component(name, defineComponent({ render: () => null }));
  }
  app.config.errorHandler = (err) => errors.push(err);
  const root = document.createElement('div');
  app.mount(root);
  await settle();

  const findSwitch = () => root.querySelector<HTMLButtonElement>('[role="switch"]');
  const toggle = () => findSwitch()!;
  const alerts = (color: string) => Array.from(root.querySelectorAll(`[data-alert="${color}"]`)).map((el) => el.textContent ?? '');

  return { alerts, errors, findSwitch, loadSettings, root, settings, toasts, toggle, unmount: () => app.unmount(), update };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI settings page: MCP confirmation switch', () => {
  it('shows the switch on, with no warning, while MCP asks', async () => {
    const page = await mountPage();

    expect(page.errors).toEqual([]);
    expect(page.toggle().getAttribute('aria-checked')).toBe('true');
    expect(page.toggle().disabled).toBe(false);
    expect(page.alerts('warning')).toEqual([]);
    page.unmount();
  });

  it('switches the question off, confirms it, and warns for as long as it stays off', async () => {
    const page = await mountPage();

    page.toggle().click();
    await settle();

    expect(page.update).toHaveBeenCalledWith({ mcpConfirmation: false });
    expect(page.toggle().getAttribute('aria-checked')).toBe('false');
    expect(page.alerts('warning').join(' ')).toContain(WARNING);
    expect(page.toasts.at(-1)?.color).toBe('success');
    page.unmount();
  });

  it('warns at once when the stored setting is already off', async () => {
    const page = await mountPage({ initial: { mcpConfirmation: false, mcpConfirmationEnforced: false } });

    expect(page.toggle().getAttribute('aria-checked')).toBe('false');
    expect(page.alerts('warning').join(' ')).toContain(WARNING);
    page.unmount();
  });

  it('switches the question back on and drops the warning', async () => {
    const page = await mountPage({ initial: { mcpConfirmation: false, mcpConfirmationEnforced: false } });

    page.toggle().click();
    await settle();

    expect(page.update).toHaveBeenCalledWith({ mcpConfirmation: true });
    expect(page.alerts('warning')).toEqual([]);
    page.unmount();
  });

  it('locks the switch and says why when the server enforces the value', async () => {
    const page = await mountPage({ initial: { mcpConfirmation: true, mcpConfirmationEnforced: true } });

    expect(page.toggle().disabled).toBe(true);
    expect(page.alerts('info').join(' ')).toContain('vom Server festgelegt');
    page.unmount();
  });

  it('reports a refused change in German and keeps the previous value', async () => {
    const page = await mountPage({ refuse: '#LTNS_0609: This AI setting is fixed by the server' });

    page.toggle().click();
    await settle();

    expect(page.errors).toEqual([]);
    expect(page.toasts.at(-1)).toMatchObject({ color: 'error', description: ENFORCED_DE });
    expect(page.toggle().getAttribute('aria-checked')).toBe('true');
    expect(page.alerts('warning')).toEqual([]);
    page.unmount();
  });

  // The direction that matters: the server keeps running destructive tools without asking, so the
  // switch must not claim it asks again.
  it('keeps showing "off" and keeps warning when switching the question back on fails', async () => {
    const page = await mountPage({ initial: { mcpConfirmation: false, mcpConfirmationEnforced: false }, refuse: 'HTTP 401' });

    page.toggle().click();
    await settle();

    expect(page.update).toHaveBeenCalledWith({ mcpConfirmation: true });
    expect(page.toasts.at(-1)?.color).toBe('error');
    expect(page.toggle().getAttribute('aria-checked')).toBe('false');
    expect(page.alerts('warning').join(' ')).toContain(WARNING);
    page.unmount();
  });

  it('offers no switch it could not save when the settings cannot be loaded', async () => {
    const page = await mountPage({ loadError: 'HTTP 404' });

    expect(page.findSwitch()).toBeNull();
    expect(page.root.textContent).toContain('Die Einstellung ist gerade nicht verfügbar.');
    expect(page.alerts('warning')).toEqual([]);
    page.unmount();
  });

  // `GET /ai/status` reports `mcp: false` while the API runs no MCP server (`ai.mcp` unset). The
  // switch would then change a setting nothing reads, so the card is not offered at all.
  it('shows no MCP card and asks for no settings while the API runs no MCP server', async () => {
    const page = await mountPage({ mcp: false });

    expect(page.errors).toEqual([]);
    expect(page.findSwitch()).toBeNull();
    expect(page.root.textContent).not.toContain('MCP-Rückfrage');
    expect(page.loadSettings).not.toHaveBeenCalled();
    page.unmount();
  });
});
