<script setup lang="ts">
// ============================================================================
// AI assistant chat page (any authenticated user — protected by auth.global).
// ============================================================================
useHead({ title: 'KI-Assistent' });
</script>

<template>
  <div class="mx-auto flex h-[calc(100vh-12rem)] max-w-3xl flex-col gap-4">
    <div>
      <h1 class="text-2xl font-bold">KI-Assistent</h1>
      <p class="text-muted">Frage den Assistenten — er kann im Backend abgesicherte Aktionen ausführen.</p>
    </div>
    <AiChat class="flex-1" />
  </div>
</template>
