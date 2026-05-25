<script setup lang="ts">
// ============================================================================
// Admin: AI budget limits (per user/tenant token & prompt caps).
// ============================================================================
import type { LtAiBudgetLimit } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Budgets' });

const admin = useLtAiAdmin();
const toast = useToast();

const limits = ref<LtAiBudgetLimit[]>([]);
const loading = ref(false);
const saving = ref(false);

const scopeItems = [
  { label: 'Nutzer', value: 'user' },
  { label: 'Tenant', value: 'tenant' },
];
const periodItems = [
  { label: 'Tag', value: 'day' },
  { label: 'Monat', value: 'month' },
  { label: 'Ohne Reset', value: 'none' },
];

const form = reactive<LtAiBudgetLimit>({ maxPrompts: undefined, maxTokens: undefined, period: 'day', refId: '', scope: 'user' });

onMounted(load);

async function load(): Promise<void> {
  loading.value = true;
  try {
    limits.value = await admin.listBudgetLimits();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}

async function create(): Promise<void> {
  if (!form.refId.trim()) {
    toast.add({ color: 'error', description: 'Bitte eine Referenz-ID (Nutzer-/Tenant-ID) angeben.', title: 'Fehler' });
    return;
  }
  saving.value = true;
  try {
    await admin.createBudgetLimit({ ...form });
    toast.add({ color: 'success', description: 'Budget gespeichert.', title: 'Erfolg' });
    form.refId = '';
    form.maxTokens = undefined;
    form.maxPrompts = undefined;
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    saving.value = false;
  }
}

async function remove(limit: LtAiBudgetLimit): Promise<void> {
  if (!limit.id) {
    return;
  }
  try {
    await admin.deleteBudgetLimit(limit.id);
    toast.add({ color: 'success', description: 'Budget gelöscht.', title: 'Erfolg' });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">KI-Budgets</h1>
      <p class="text-muted">Token- und Anfrage-Limits pro Nutzer oder Tenant (0/leer = unbegrenzt).</p>
    </div>

    <UCard>
      <template #header><h2 class="font-semibold">Neues Limit</h2></template>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="Bereich"><USelectMenu v-model="form.scope" :items="scopeItems" value-key="value" /></UFormField>
        <UFormField label="Zeitraum"><USelectMenu v-model="form.period" :items="periodItems" value-key="value" /></UFormField>
        <UFormField label="Referenz-ID (Nutzer/Tenant)" class="sm:col-span-2"><UInput v-model="form.refId" placeholder="ObjectId" /></UFormField>
        <UFormField label="Max. Tokens"><UInput v-model.number="form.maxTokens" type="number" placeholder="unbegrenzt" /></UFormField>
        <UFormField label="Max. Anfragen"><UInput v-model.number="form.maxPrompts" type="number" placeholder="unbegrenzt" /></UFormField>
      </div>
      <template #footer><UButton icon="i-lucide-plus" :loading="saving" @click="create"> Limit anlegen </UButton></template>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">Bestehende Limits</h2></template>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <p v-else-if="!limits.length" class="py-8 text-center text-muted">Keine Limits konfiguriert.</p>
      <div v-else class="divide-y">
        <div v-for="limit in limits" :key="limit.id" class="flex items-center justify-between py-3">
          <div>
            <p class="font-medium">{{ limit.scope === 'user' ? 'Nutzer' : 'Tenant' }} · {{ limit.refId }}</p>
            <p class="text-xs text-muted">{{ limit.maxTokens || '∞' }} Tokens · {{ limit.maxPrompts || '∞' }} Anfragen · {{ limit.period }}</p>
          </div>
          <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash" @click="remove(limit)" />
        </div>
      </div>
    </UCard>
  </div>
</template>
