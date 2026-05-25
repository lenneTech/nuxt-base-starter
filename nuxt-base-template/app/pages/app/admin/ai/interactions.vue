<script setup lang="ts">
// ============================================================================
// Admin: AI interaction audit log (read-only). Requires ai.audit on the backend.
// ============================================================================
import type { LtAiInteraction } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Audit-Log' });

const admin = useLtAiAdmin();
const toast = useToast();

const interactions = ref<LtAiInteraction[]>([]);
const loading = ref(false);

onMounted(load);

async function load(): Promise<void> {
  loading.value = true;
  try {
    interactions.value = await admin.listInteractions();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">KI-Audit-Log</h1>
        <p class="text-muted">Protokollierte Prompt-Läufe (nur bei aktiviertem Audit).</p>
      </div>
      <UButton variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="load"> Aktualisieren </UButton>
    </div>

    <UCard>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <p v-else-if="!interactions.length" class="py-8 text-center text-muted">Keine Einträge.</p>
      <div v-else class="divide-y">
        <div v-for="item in interactions" :key="item.id" class="space-y-1 py-3">
          <div class="flex items-center justify-between gap-3">
            <p class="truncate font-medium">{{ item.prompt || '—' }}</p>
            <span class="shrink-0 text-xs text-muted">{{ item.createdAt ? new Date(item.createdAt).toLocaleString('de-DE') : '' }}</span>
          </div>
          <p class="truncate text-sm text-muted">{{ item.responseText }}</p>
          <div class="flex flex-wrap gap-2 text-xs text-muted">
            <span>{{ item.totalTokens ?? 0 }} Tokens</span>
            <span v-if="item.iterations">· {{ item.iterations }} Iter.</span>
            <span v-if="item.actions?.length">· {{ item.actions.length }} Aktion(en)</span>
            <span v-if="item.userId">· Nutzer {{ item.userId }}</span>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
