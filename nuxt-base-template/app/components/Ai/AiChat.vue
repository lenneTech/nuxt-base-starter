<script setup lang="ts">
// ============================================================================
// AI chat container — wires useLtAiChat (streaming, conversation, budget,
// confirmation) to a message list + input. Self-contained and reusable.
// ============================================================================
const props = withDefaults(
  defineProps<{
    /** Continue an existing conversation. */
    conversationId?: string;
    /** Execution mode for every turn. */
    mode?: 'auto' | 'plan';
    /** Show the user connection picker (default true). */
    showConnectionPicker?: boolean;
  }>(),
  { showConnectionPicker: true },
);

const { budget, clear, confirm, contextWindow, error, messages, send, stop, streaming } = useLtAiChat({
  conversationId: props.conversationId,
  // Enrich each prompt with lightweight client context (untrusted, capped server-side).
  metadata: () => ({ url: import.meta.client ? window.location.href : undefined }),
  mode: props.mode,
});

const input = ref('');
const listEl = ref<HTMLElement | null>(null);

// Auto-scroll to the latest message while streaming.
watch(
  () => messages.value.map((m) => m.content).join('|'),
  async () => {
    await nextTick();
    listEl.value?.scrollTo({ behavior: 'smooth', top: listEl.value.scrollHeight });
  },
);

async function onSubmit(): Promise<void> {
  const text = input.value;
  input.value = '';
  await send(text);
}
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <AiConnectionPicker v-if="showConnectionPicker" />
      <div class="flex items-center gap-3">
        <AiTokenBar :budget="budget" />
        <AiContextWindow :context-window="contextWindow" />
        <AiUsageBadge :budget="budget" />
        <UButton v-if="messages.length" size="sm" color="neutral" variant="ghost" icon="i-lucide-eraser" @click="clear"> Leeren </UButton>
      </div>
    </div>

    <!-- Messages -->
    <div ref="listEl" class="flex-1 space-y-3 overflow-y-auto rounded-lg border border-default p-4">
      <div v-if="!messages.length" class="flex h-full min-h-40 items-center justify-center text-center text-muted">
        <div>
          <UIcon name="i-lucide-sparkles" class="mx-auto mb-2 size-8" />
          <p>Stelle dem KI-Assistenten eine Frage.</p>
        </div>
      </div>
      <AiMessage v-for="(message, i) in messages" :key="i" :message="message" @confirm="confirm" />
    </div>

    <!-- Error -->
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-alert-circle" :description="error" />

    <!-- Input -->
    <form class="flex items-end gap-2" @submit.prevent="onSubmit">
      <UTextarea v-model="input" :rows="1" autoresize class="flex-1" placeholder="Nachricht eingeben …" :disabled="streaming" @keydown.enter.exact.prevent="onSubmit" />
      <UButton v-if="streaming" color="neutral" variant="outline" icon="i-lucide-square" aria-label="Stop" @click="stop" />
      <UButton v-else type="submit" color="primary" icon="i-lucide-send" :disabled="!input.trim()" aria-label="Senden" />
    </form>
  </div>
</template>
