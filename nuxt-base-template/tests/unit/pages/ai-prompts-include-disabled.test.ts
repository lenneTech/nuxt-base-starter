/**
 * Mounts the real prompt management page (app/pages/app/settings/ai-prompts.vue) and the real chat
 * picker (app/components/Ai/AiPromptPicker.vue) and pins which prompts each one asks for.
 *
 * WHAT IT PINS
 *
 * `GET /ai/prompts` answers the active prompts only, which is what the chat picker offers. A prompt
 * saved with "Aktiv" switched off therefore vanished from the management page too: its owner could
 * neither see it nor switch it on again, and the "inaktiv" badge never had anything to show.
 * nest-server 12.7.0 lists the disabled prompts on `?includeDisabled=true`, and nuxt-extensions
 * 1.27.0 sends it for `useLtAiPrompts().load({ includeDisabled: true })`, for the reload after a
 * save as well. So the management page loads with the option, and the picker loads without it: a
 * disabled prompt must never be offered in the chat.
 *
 * The requests themselves, the reload after saving a disabled prompt included, are checked against
 * a real API in `tests/e2e/ai-prompts-include-disabled.spec.ts`.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports are provided as globals,
 * `useLtAiPrompts()` is a fake that records the arguments of every `load()`, and the Nuxt UI
 * components are stubs that render their slots.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, onMounted, reactive, ref, type Component } from 'vue';

import AiPromptPicker from '~/components/Ai/AiPromptPicker.vue';
import AiPromptsPage from '~/pages/app/settings/ai-prompts.vue';

interface FakePrompt {
  content: string;
  enabled?: boolean;
  id: string;
  name: string;
  ownerId: string;
  scope: 'tenant' | 'user';
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await nextTick();
}

const passthrough = (tag: string) =>
  defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h(tag, [slots.header?.(), slots.default?.(), slots.footer?.()]),
  });
const empty = defineComponent({ render: () => null });

async function mount(component: Component, prompts: FakePrompt[] = []) {
  const loads: unknown[][] = [];

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('isAdminUser', () => false);
  vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
  vi.stubGlobal('useLtAuth', () => ({ user: ref({ id: 'u1' }) }));
  vi.stubGlobal('useLtAiPrompts', () => ({
    create: vi.fn(async () => {}),
    error: ref(null),
    load: vi.fn(async (...args: unknown[]) => {
      loads.push(args);
    }),
    loading: ref(false),
    prompts: ref(prompts),
    remove: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
  }));

  const app = createApp(component);
  for (const name of ['UBadge', 'UButton', 'UCard', 'UDropdownMenu', 'UFormField']) app.component(name, passthrough('div'));
  for (const name of ['AiPlaceholderHint', 'UAlert', 'UIcon', 'UInput', 'USelectMenu', 'USwitch', 'UTextarea']) app.component(name, empty);
  const errors: unknown[] = [];
  app.config.errorHandler = (err) => errors.push(err);

  const root = document.createElement('div');
  app.mount(root);
  await settle();

  return { errors, loads, root, unmount: () => app.unmount() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('which prompts the AI pages load', () => {
  it('the management page asks for the disabled prompts too', async () => {
    const page = await mount(AiPromptsPage);

    // One load, with the option. Before 2.38.3 it was `onMounted(load)`, a load without it.
    expect(page.loads).toEqual([[{ includeDisabled: true }]]);
    expect(page.errors).toEqual([]);
    page.unmount();
  });

  it('the management page shows a disabled prompt it got, marked inaktiv', async () => {
    const page = await mount(AiPromptsPage, [{ content: 'Text', enabled: false, id: 'p1', name: 'Ausgeschaltet', ownerId: 'u1', scope: 'user' }]);

    const row = page.root.querySelector('[data-test="prompt-row"]');
    expect(row?.textContent).toContain('Ausgeschaltet');
    expect(row?.textContent).toContain('inaktiv');
    page.unmount();
  });

  it('the chat picker asks for the active prompts only', async () => {
    const picker = await mount(AiPromptPicker);

    // A load without any option: `GET /ai/prompts`, which never lists a disabled prompt.
    expect(picker.loads).toEqual([[]]);
    expect(picker.errors).toEqual([]);
    picker.unmount();
  });
});
