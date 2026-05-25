<script setup lang="ts">
// ============================================================================
// Admin: AI connection management (CRUD + capability auto-detection).
// Protected by admin.global middleware (/app/admin/*).
// ============================================================================
import type { LtAiConnection } from '@lenne.tech/nuxt-extensions';

import ModalAiConnection from '~/components/Ai/ModalAiConnection.vue';

useHead({ title: 'KI-Verbindungen' });

const admin = useLtAiAdmin();
const overlay = useOverlay();
const toast = useToast();

const connections = ref<LtAiConnection[]>([]);
const loading = ref(false);
const busyId = ref<string | null>(null);

onMounted(load);

async function load(): Promise<void> {
  loading.value = true;
  try {
    connections.value = await admin.listConnections();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}

async function openModal(connection?: LtAiConnection): Promise<void> {
  const modal = overlay.create(ModalAiConnection, { props: { connection } });
  const saved = await modal.open();
  if (saved) {
    await load();
  }
}

async function detect(connection: LtAiConnection): Promise<void> {
  busyId.value = connection.id;
  try {
    const updated = await admin.detectCapabilities(connection.id);
    toast.add({
      color: 'success',
      description: `JSON: ${cap(updated.supportsJsonResponse)}, Tools: ${cap(updated.supportsNativeTools)}`,
      title: 'Fähigkeiten erkannt',
    });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    busyId.value = null;
  }
}

async function remove(connection: LtAiConnection): Promise<void> {
  busyId.value = connection.id;
  try {
    await admin.deleteConnection(connection.id);
    toast.add({ color: 'success', description: 'Verbindung gelöscht.', title: 'Erfolg' });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    busyId.value = null;
  }
}

function cap(value?: boolean): string {
  return value === undefined ? 'auto' : value ? 'ja' : 'nein';
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">KI-Verbindungen</h1>
        <p class="text-muted">Verwalte die LLM-Verbindungen. Fähigkeiten werden bei leerer Angabe automatisch erkannt.</p>
      </div>
      <UButton icon="i-lucide-plus" @click="openModal()"> Verbindung hinzufügen </UButton>
    </div>

    <UCard>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <p v-else-if="!connections.length" class="py-8 text-center text-muted">Noch keine Verbindungen.</p>
      <div v-else class="divide-y">
        <div v-for="conn in connections" :key="conn.id" class="flex items-center justify-between gap-3 py-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="truncate font-medium">{{ conn.name }}</p>
              <UBadge v-if="conn.isDefault" size="sm" color="primary" variant="subtle">Standard</UBadge>
              <UBadge v-if="conn.enabled === false" size="sm" color="neutral" variant="subtle">Deaktiviert</UBadge>
              <UBadge v-if="conn.hasApiKey" size="sm" color="success" variant="subtle" icon="i-lucide-key">Key</UBadge>
            </div>
            <p class="truncate text-xs text-muted">{{ conn.model }} · {{ conn.baseUrl }}</p>
            <p class="text-xs text-muted">JSON: {{ cap(conn.supportsJsonResponse) }} · Tools: {{ cap(conn.supportsNativeTools) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UTooltip text="Fähigkeiten erkennen">
              <UButton size="sm" variant="ghost" icon="i-lucide-radar" :loading="busyId === conn.id" @click="detect(conn)" />
            </UTooltip>
            <UButton size="sm" variant="ghost" icon="i-lucide-pencil" @click="openModal(conn)" />
            <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash" :loading="busyId === conn.id" @click="remove(conn)" />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
