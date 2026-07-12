<script setup lang="ts">
// ============================================================================
// Admin: learned AI prompt hints — review/approve/reject the governed
// self-improvement loop. Only approved + enabled hints reach the prompt; hints
// only ever ADD guidance and can never relax the backend-enforced security core.
// ============================================================================
import type { LtAiPromptHint, LtAiPromptHintInput } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Lern-Hinweise' });
definePageMeta({ ssr: false });

const admin = useLtAiAdmin();
const toast = useToast();

const hints = ref<LtAiPromptHint[]>([]);
const loading = ref(false);
const saving = ref(false);
const showCreate = ref(false);

const form = reactive<LtAiPromptHintInput>({ content: '', scope: '', trigger: 'manual' });

const statusColor: Record<string, 'error' | 'neutral' | 'success' | 'warning'> = {
  approved: 'success',
  rejected: 'error',
  suggested: 'warning',
};

const suggested = computed(() => hints.value.filter((h) => (h.status || 'suggested') === 'suggested'));
const reviewed = computed(() => hints.value.filter((h) => (h.status || 'suggested') !== 'suggested'));

onMounted(load);

async function load(): Promise<void> {
  loading.value = true;
  try {
    hints.value = await admin.listPromptHints();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}

async function setStatus(hint: LtAiPromptHint, status: 'approved' | 'rejected' | 'suggested'): Promise<void> {
  try {
    await admin.updatePromptHint(hint.id, { status });
    toast.add({ color: 'success', description: `Hinweis auf "${status}" gesetzt.`, title: 'Erfolg' });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

async function toggleEnabled(hint: LtAiPromptHint): Promise<void> {
  try {
    await admin.updatePromptHint(hint.id, { enabled: hint.enabled === false });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

async function remove(hint: LtAiPromptHint): Promise<void> {
  try {
    await admin.deletePromptHint(hint.id);
    toast.add({ color: 'success', description: 'Hinweis gelöscht.', title: 'Erfolg' });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

async function create(): Promise<void> {
  if (!form.content?.trim()) {
    toast.add({ color: 'error', description: 'Bitte einen Hinweistext angeben.', title: 'Fehler' });
    return;
  }
  saving.value = true;
  try {
    await admin.createPromptHint({ ...form, scope: form.scope?.trim() || undefined, status: 'approved' });
    toast.add({ color: 'success', description: 'Hinweis angelegt und freigegeben.', title: 'Erfolg' });
    form.content = '';
    form.scope = '';
    showCreate.value = false;
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">KI-Lern-Hinweise</h1>
        <p class="text-muted">
          Aus wiederkehrenden Fehlern automatisch abgeleitete Hinweise. Nur <strong>freigegebene</strong> und aktive Hinweise fließen in den Prompt ein. Hinweise ergänzen nur
          Anleitung — sie können das Rechtemanagement nie aufweichen (das wird serverseitig unabhängig erzwungen).
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        variant="soft"
        @click="
          () => {
            showCreate = !showCreate;
          }
        "
      >
        Manuell
      </UButton>
    </div>

    <UCard v-if="showCreate">
      <template #header><h2 class="font-semibold">Manuellen Hinweis anlegen</h2></template>
      <div class="grid grid-cols-1 gap-3">
        <UFormField label="Bereich (scope)" help="z. B. ein Tool-Name; leer = global">
          <UInput v-model="form.scope" placeholder="global" />
        </UFormField>
        <UFormField label="Hinweistext">
          <UTextarea v-model="form.content" :rows="3" placeholder="Anleitung, die dem Modell hinzugefügt wird" />
        </UFormField>
      </div>
      <template #footer>
        <UButton icon="i-lucide-plus" :loading="saving" @click="create"> Anlegen & freigeben </UButton>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Zu prüfen <UBadge v-if="suggested.length" size="xs" color="warning">{{ suggested.length }}</UBadge>
        </h2>
      </template>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <p v-else-if="!suggested.length" class="py-8 text-center text-muted">Keine offenen Vorschläge.</p>
      <div v-else class="divide-y">
        <div v-for="hint in suggested" :key="hint.id" class="py-3">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge size="xs" :color="statusColor[hint.status || 'suggested']" variant="subtle">{{ hint.status || 'suggested' }}</UBadge>
            <UBadge size="xs" color="neutral" variant="subtle">{{ hint.trigger || 'manual' }}</UBadge>
            <UBadge v-if="hint.scope" size="xs" color="info" variant="subtle">{{ hint.scope }}</UBadge>
            <span class="text-xs text-muted">{{ hint.occurrences ?? 1 }}× beobachtet</span>
          </div>
          <p class="mt-1 text-sm">{{ hint.content }}</p>
          <div class="mt-2 flex gap-2">
            <UButton size="sm" color="success" icon="i-lucide-check" @click="setStatus(hint, 'approved')"> Freigeben </UButton>
            <UButton size="sm" variant="ghost" color="error" icon="i-lucide-x" @click="setStatus(hint, 'rejected')"> Ablehnen </UButton>
            <UButton size="sm" variant="ghost" icon="i-lucide-trash" @click="remove(hint)" />
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">Geprüfte Hinweise</h2></template>
      <p v-if="!reviewed.length" class="py-8 text-center text-muted">Noch keine geprüften Hinweise.</p>
      <div v-else class="divide-y">
        <div v-for="hint in reviewed" :key="hint.id" class="flex items-start justify-between gap-3 py-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge size="xs" :color="statusColor[hint.status || 'suggested']" variant="subtle">{{ hint.status }}</UBadge>
              <UBadge size="xs" color="neutral" variant="subtle">{{ hint.trigger || 'manual' }}</UBadge>
              <UBadge v-if="hint.scope" size="xs" color="info" variant="subtle">{{ hint.scope }}</UBadge>
              <UBadge v-if="hint.enabled === false" size="xs" color="warning" variant="subtle">inaktiv</UBadge>
            </div>
            <p class="mt-1 text-sm">{{ hint.content }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <USwitch :model-value="hint.enabled !== false" size="sm" @update:model-value="toggleEnabled(hint)" />
            <UButton v-if="hint.status !== 'approved'" size="sm" variant="ghost" color="success" icon="i-lucide-check" @click="setStatus(hint, 'approved')" />
            <UButton v-if="hint.status !== 'rejected'" size="sm" variant="ghost" color="error" icon="i-lucide-x" @click="setStatus(hint, 'rejected')" />
            <UButton size="sm" variant="ghost" icon="i-lucide-trash" @click="remove(hint)" />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
