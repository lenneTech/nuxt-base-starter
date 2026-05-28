<script setup lang="ts">
// ============================================================================
// Admin: AI prompt templates — edit the building blocks of the system prompt.
// The backend ships built-in defaults for every key; a row here OVERRIDES the
// default for its key (optionally scoped by locale/capability).
// ============================================================================
import type { LtAiSlot, LtAiSlotInput } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Slots' });

const admin = useLtAiAdmin();
const toast = useToast();

const templates = ref<LtAiSlot[]>([]);
const loading = ref(false);
const saving = ref(false);
const editId = ref<null | string>(null);

const capabilityItems = [
  { label: 'Alle Modi', value: 'all' },
  { label: 'Native Tools', value: 'native' },
  { label: 'Emulierte Tools', value: 'emulated' },
];

function emptyForm(): LtAiSlotInput {
  return { capability: 'all', content: '', description: '', enabled: true, key: '', locale: '', order: 100 };
}

const form = reactive<LtAiSlotInput>(emptyForm());

onMounted(load);

async function load(): Promise<void> {
  loading.value = true;
  try {
    templates.value = await admin.listSlots();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}

function reset(): void {
  editId.value = null;
  Object.assign(form, emptyForm());
}

function edit(template: LtAiSlot): void {
  editId.value = template.id;
  Object.assign(form, {
    capability: template.capability || 'all',
    content: template.content || '',
    description: template.description || '',
    enabled: template.enabled !== false,
    key: template.key || '',
    locale: template.locale || '',
    order: template.order ?? 100,
  });
}

async function save(): Promise<void> {
  if (!form.key?.trim()) {
    toast.add({ color: 'error', description: 'Bitte einen Slot (key) angeben.', title: 'Fehler' });
    return;
  }
  if (!form.content?.trim()) {
    toast.add({ color: 'error', description: 'Bitte einen Inhalt angeben.', title: 'Fehler' });
    return;
  }
  saving.value = true;
  try {
    const payload: LtAiSlotInput = { ...form, locale: form.locale?.trim() || undefined };
    if (editId.value) {
      await admin.updateSlot(editId.value, payload);
      toast.add({ color: 'success', description: 'Vorlage aktualisiert.', title: 'Erfolg' });
    } else {
      await admin.createSlot(payload);
      toast.add({ color: 'success', description: 'Vorlage angelegt.', title: 'Erfolg' });
    }
    reset();
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    saving.value = false;
  }
}

async function remove(template: LtAiSlot): Promise<void> {
  try {
    await admin.deleteSlot(template.id);
    toast.add({ color: 'success', description: 'Vorlage gelöscht.', title: 'Erfolg' });
    if (editId.value === template.id) {
      reset();
    }
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

async function toggleEnabled(template: LtAiSlot): Promise<void> {
  try {
    await admin.updateSlot(template.id, { enabled: template.enabled === false });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">KI-Slots</h1>
      <p class="text-muted">
        Bausteine des System-Prompts. Das Backend liefert für jeden Slot sinnvolle Standards — ein Eintrag hier
        <strong>überschreibt</strong> den Standard für seinen Slot (optional je Sprache/Modus). Platzhalter wie <code>&#123;&#123;roles&#125;&#125;</code>,
        <code>&#123;&#123;tools&#125;&#125;</code>, <code>&#123;&#123;toolCatalog&#125;&#125;</code> oder <code>&#123;&#123;documentation&#125;&#125;</code> werden zur Laufzeit
        ersetzt.
      </p>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ editId ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}</h2>
      </template>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="Slot (key)" help="z. B. base, permissions, anti_hallucination">
          <UInput v-model="form.key" placeholder="base" :disabled="!!editId" />
        </UFormField>
        <UFormField label="Modus (capability)">
          <USelectMenu v-model="form.capability" :items="capabilityItems" value-key="value" />
        </UFormField>
        <UFormField label="Sprache (locale)" help="leer = alle Sprachen">
          <UInput v-model="form.locale" placeholder="de" />
        </UFormField>
        <UFormField label="Reihenfolge (order)">
          <UInput v-model.number="form.order" type="number" placeholder="100" />
        </UFormField>
        <UFormField label="Beschreibung" class="sm:col-span-2">
          <UInput v-model="form.description" placeholder="Wofür ist dieser Baustein?" />
        </UFormField>
        <UFormField label="Inhalt" class="sm:col-span-2">
          <UTextarea v-model="form.content" :rows="5" placeholder="Fragment-Text (Platzhalter in doppelten geschweiften Klammern)" />
        </UFormField>
        <UFormField label="Aktiv">
          <USwitch v-model="form.enabled" />
        </UFormField>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <UButton :icon="editId ? 'i-lucide-save' : 'i-lucide-plus'" :loading="saving" @click="save">
            {{ editId ? 'Speichern' : 'Vorlage anlegen' }}
          </UButton>
          <UButton v-if="editId" variant="ghost" icon="i-lucide-x" @click="reset"> Abbrechen </UButton>
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">Bestehende Vorlagen</h2></template>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <p v-else-if="!templates.length" class="py-8 text-center text-muted">Keine eigenen Vorlagen — es gelten die eingebauten Standards.</p>
      <div v-else class="divide-y">
        <div v-for="template in templates" :key="template.id" class="flex items-start justify-between gap-3 py-3">
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-2 font-medium">
              <span>{{ template.key }}</span>
              <UBadge size="xs" color="neutral" variant="subtle">{{ template.capability || 'all' }}</UBadge>
              <UBadge v-if="template.locale" size="xs" color="info" variant="subtle">{{ template.locale }}</UBadge>
              <UBadge size="xs" variant="subtle">#{{ template.order ?? 100 }}</UBadge>
              <UBadge v-if="template.enabled === false" size="xs" color="warning" variant="subtle">inaktiv</UBadge>
            </p>
            <p v-if="template.description" class="text-xs text-muted">{{ template.description }}</p>
            <p class="mt-1 line-clamp-2 text-xs text-muted">{{ template.content }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <USwitch :model-value="template.enabled !== false" size="sm" @update:model-value="toggleEnabled(template)" />
            <UButton size="sm" variant="ghost" icon="i-lucide-pencil" @click="edit(template)" />
            <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash" @click="remove(template)" />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
