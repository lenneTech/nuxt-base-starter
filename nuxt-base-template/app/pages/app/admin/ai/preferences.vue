<script setup lang="ts">
// ============================================================================
// Admin: AI connection preferences (tenant/user defaults + tenant-enforced).
// ============================================================================
import type { LtAiConnection, LtAiConnectionPreference } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Verbindungs-Präferenzen' });
definePageMeta({ ssr: false });

const admin = useLtAiAdmin();
const toast = useToast();

const preferences = ref<LtAiConnectionPreference[]>([]);
const connections = ref<LtAiConnection[]>([]);
const loading = ref(false);
const saving = ref(false);

const scopeItems = [
  { label: 'Tenant', value: 'tenant' },
  { label: 'Nutzer', value: 'user' },
];

const form = reactive<LtAiConnectionPreference>({ connectionId: '', enforced: false, refId: '', scope: 'tenant' });

const connectionItems = computed(() => connections.value.map((c) => ({ label: c.name || c.id, value: c.id })));

onMounted(async () => {
  await Promise.all([load(), loadConnections()]);
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    preferences.value = await admin.listPreferences();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}

async function loadConnections(): Promise<void> {
  try {
    connections.value = await admin.listConnections();
  } catch {
    // listing connections is best-effort for the picker
  }
}

async function save(): Promise<void> {
  if (!form.refId.trim() || !form.connectionId) {
    toast.add({ color: 'error', description: 'Referenz-ID und Verbindung sind erforderlich.', title: 'Fehler' });
    return;
  }
  saving.value = true;
  try {
    await admin.setPreference({ ...form, enforced: form.scope === 'tenant' ? form.enforced : false });
    toast.add({ color: 'success', description: 'Präferenz gespeichert.', title: 'Erfolg' });
    form.refId = '';
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    saving.value = false;
  }
}

async function remove(pref: LtAiConnectionPreference): Promise<void> {
  if (!pref.id) {
    return;
  }
  try {
    await admin.deletePreference(pref.id);
    toast.add({ color: 'success', description: 'Präferenz gelöscht.', title: 'Erfolg' });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

function connectionName(id: string): string {
  return connections.value.find((c) => c.id === id)?.name || id;
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">KI-Verbindungs-Präferenzen</h1>
      <p class="text-muted">Standard-Verbindung pro Tenant/Nutzer; „erzwungen" überschreibt die Nutzerwahl.</p>
    </div>

    <UCard>
      <template #header><h2 class="font-semibold">Neue Präferenz</h2></template>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="Bereich"><USelectMenu v-model="form.scope" :items="scopeItems" value-key="value" /></UFormField>
        <UFormField label="Verbindung"><USelectMenu v-model="form.connectionId" :items="connectionItems" value-key="value" placeholder="Verbindung wählen" /></UFormField>
        <UFormField label="Referenz-ID (Tenant/Nutzer)" class="sm:col-span-2"><UInput v-model="form.refId" placeholder="ObjectId" /></UFormField>
        <UCheckbox v-if="form.scope === 'tenant'" v-model="form.enforced" label="Erzwingen (Nutzer können nicht abweichen)" />
      </div>
      <template #footer><UButton icon="i-lucide-plus" :loading="saving" @click="save"> Präferenz speichern </UButton></template>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">Bestehende Präferenzen</h2></template>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <p v-else-if="!preferences.length" class="py-8 text-center text-muted">Keine Präferenzen konfiguriert.</p>
      <div v-else class="divide-y">
        <div v-for="pref in preferences" :key="pref.id" class="flex items-center justify-between py-3">
          <div>
            <p class="font-medium">
              {{ pref.scope === 'user' ? 'Nutzer' : 'Tenant' }} · {{ pref.refId }}
              <UBadge v-if="pref.enforced" size="sm" color="warning" variant="subtle">erzwungen</UBadge>
            </p>
            <p class="text-xs text-muted">→ {{ connectionName(pref.connectionId) }}</p>
          </div>
          <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash" @click="remove(pref)" />
        </div>
      </div>
    </UCard>
  </div>
</template>
