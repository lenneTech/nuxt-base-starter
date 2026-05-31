<script setup lang="ts">
// ============================================================================
// Prompt ("Vorlage") picker — drop-down next to the chat input. Lists every
// prompt the current user is allowed to see (own private + tenant public)
// and emits the selected prompt so the parent can insert its content.
// ============================================================================
import type { LtAiPrompt } from '@lenne.tech/nuxt-extensions';

const emit = defineEmits<{ select: [prompt: LtAiPrompt] }>();

const { error, load, loading, prompts } = useLtAiPrompts();

onMounted(() => {
  void load();
});

// Group by scope so the menu is easy to scan.
const grouped = computed(() => ({
  user: prompts.value.filter((s) => s.scope === 'user'),
  tenant: prompts.value.filter((s) => s.scope === 'tenant'),
}));

function iconFor(s: LtAiPrompt): string | undefined {
  return s.icon?.startsWith('i-') ? s.icon : undefined;
}

function pick(s: LtAiPrompt): void {
  emit('select', s);
}

const menuItems = computed(() => {
  const sections: Array<Array<{ label: string; icon?: string; onSelect: () => void; disabled?: boolean }>> = [];
  const order: Array<['user' | 'tenant', string]> = [
    ['user', 'Eigene (privat)'],
    ['tenant', 'Geteilt (Tenant)'],
  ];
  for (const [key, label] of order) {
    const items = grouped.value[key];
    if (!items.length) continue;
    sections.push([
      { label, icon: undefined, onSelect: () => {}, disabled: true },
      ...items.map((s) => ({
        label: s.name,
        icon: iconFor(s),
        onSelect: () => pick(s),
      })),
    ]);
  }
  if (!sections.length) {
    sections.push([{ label: 'Noch keine Vorlagen', onSelect: () => {}, disabled: true }]);
  }
  return sections;
});
</script>

<template>
  <UDropdownMenu :items="menuItems" :ui="{ content: 'min-w-64' }">
    <UButton
      size="sm"
      color="neutral"
      variant="ghost"
      :icon="loading ? 'i-lucide-loader-2' : 'i-lucide-clipboard-list'"
      :class="{ 'animate-spin': loading }"
      aria-label="Vorlagen einfügen"
      data-test="ai-prompt-picker"
    >
      Vorlagen
    </UButton>
    <template v-if="error" #content-bottom>
      <p class="px-3 py-1 text-xs text-error">{{ error }}</p>
    </template>
  </UDropdownMenu>
</template>
