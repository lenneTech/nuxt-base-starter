<script setup lang="ts">
// ============================================================================
// AI connection picker — user self-service selection of the LLM connection.
// Hidden when only one connection is available or the choice is locked by a
// mandatory (admin/tenant-enforced) layer.
// ============================================================================
const toast = useToast();
const { connections, load, locked, select, selected } = useLtAiConnections();

const items = computed(() =>
  connections.value.map((c) => ({
    label: c.name || c.id,
    value: c.id,
  })),
);

const selectedId = computed({
  get: () => selected.value?.id,
  set: (id?: string) => {
    if (id) {
      void choose(id);
    }
  },
});

onMounted(load);

async function choose(id: string): Promise<void> {
  try {
    await select(id);
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}
</script>

<template>
  <div v-if="connections.length > 1" class="flex items-center gap-2">
    <UIcon name="i-lucide-plug" class="size-4 text-muted" />
    <USelectMenu v-model="selectedId" :items="items" value-key="value" :disabled="locked" placeholder="KI-Verbindung wählen" size="sm" class="min-w-48" />
    <UTooltip v-if="locked" text="Die Verbindung ist vorgegeben und kann nicht geändert werden.">
      <UIcon name="i-lucide-lock" class="size-4 text-muted" />
    </UTooltip>
  </div>
</template>
