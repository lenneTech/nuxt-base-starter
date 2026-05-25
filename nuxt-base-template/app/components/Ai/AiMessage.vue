<script setup lang="ts">
// ============================================================================
// A single chat message (user or assistant). Renders the streamed/final text,
// executed tool actions, and the confirmation prompt for mutating/destructive
// actions awaiting approval.
// ============================================================================
import type { LtAiMessage } from '@lenne.tech/nuxt-extensions';

defineProps<{
  message: LtAiMessage;
}>();

const emit = defineEmits<{
  confirm: [];
}>();
</script>

<template>
  <div class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
    <div class="max-w-[85%] rounded-lg px-4 py-2 text-sm" :class="message.role === 'user' ? 'bg-primary text-inverted' : 'bg-elevated text-default'">
      <!-- Text (streamed or final) -->
      <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
      <span v-if="message.pending" class="inline-block animate-pulse text-muted">▍</span>

      <!-- Executed tool actions -->
      <div v-if="message.actions?.length" class="mt-2 flex flex-wrap gap-1">
        <UBadge
          v-for="(action, i) in message.actions"
          :key="i"
          size="sm"
          :color="action.success === false ? 'error' : 'success'"
          variant="subtle"
          :icon="action.success === false ? 'i-lucide-x' : 'i-lucide-check'"
        >
          {{ action.name }}
        </UBadge>
      </div>

      <!-- Denied (plan mode, missing permissions) -->
      <UAlert v-if="message.denied" class="mt-2" color="error" variant="subtle" icon="i-lucide-shield-x" :description="'Es wurde nichts ausgeführt.'" />

      <!-- Confirmation gate -->
      <div v-if="message.requiresConfirmation" class="mt-3 space-y-2">
        <div v-if="message.pendingActions?.length" class="flex flex-wrap gap-1">
          <UBadge v-for="(action, i) in message.pendingActions" :key="i" size="sm" color="warning" variant="subtle" icon="i-lucide-alert-triangle">
            {{ action.name }}
          </UBadge>
        </div>
        <UButton size="sm" color="warning" icon="i-lucide-check" @click="emit('confirm')"> Ausführung bestätigen </UButton>
      </div>
    </div>
  </div>
</template>
