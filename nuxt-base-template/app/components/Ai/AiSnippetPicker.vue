<script setup lang="ts">
// ============================================================================
// Snippet ("Vorlage") picker — drop-down next to the chat input. Lists every
// snippet the current user is allowed to see (own + tenant + global) and emits
// the selected snippet's content so the parent can insert it into the input.
// ============================================================================
import type { LtAiPromptSnippet } from '@lenne.tech/nuxt-extensions';

const emit = defineEmits<{ select: [snippet: LtAiPromptSnippet] }>();

const { error, load, loading, snippets } = useLtAiSnippets();

onMounted(() => {
  void load();
});

// Group by scope so the menu is easy to scan.
const grouped = computed(() => ({
  user: snippets.value.filter((s) => s.scope === 'user'),
  tenant: snippets.value.filter((s) => s.scope === 'tenant'),
  global: snippets.value.filter((s) => s.scope === 'global'),
}));

function iconFor(s: LtAiPromptSnippet): string | undefined {
  return s.icon?.startsWith('i-') ? s.icon : undefined;
}

function pick(s: LtAiPromptSnippet): void {
  emit('select', s);
}

const menuItems = computed(() => {
  const sections: Array<Array<{ label: string; icon?: string; onSelect: () => void; disabled?: boolean }>> = [];
  const order: Array<['user' | 'tenant' | 'global', string]> = [
    ['user', 'Eigene'],
    ['tenant', 'Geteilt (Tenant)'],
    ['global', 'Global'],
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
      data-test="ai-snippet-picker"
    >
      Vorlagen
    </UButton>
    <template v-if="error" #content-bottom>
      <p class="px-3 py-1 text-xs text-error">{{ error }}</p>
    </template>
  </UDropdownMenu>
</template>
