<script setup lang="ts">
// ============================================================================
// Admin: AI Slots — tenant-scoped overrides of the system-prompt building
// blocks. Framework defaults appear as virtual rows; "Bearbeiten" creates an
// override, "Zurücksetzen" deletes it, "Deaktivieren" on a system slot
// soft-deletes it for the tenant (disabled override). "Löschen" on a custom
// tenant slot is a real, non-recoverable delete.
// ============================================================================
import type { LtAiEffectiveSlot, LtAiSlotInput } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Slots' });

const admin = useLtAiAdmin();
const toast = useToast();

const slots = ref<LtAiEffectiveSlot[]>([]);
const loading = ref(false);
const saving = ref(false);
const editing = ref<LtAiEffectiveSlot | null>(null);

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
    slots.value = await admin.listEffectiveSlots();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}

function startNew(): void {
  editing.value = null;
  Object.assign(form, emptyForm());
}

function startEdit(s: LtAiEffectiveSlot): void {
  editing.value = s;
  Object.assign(form, {
    capability: s.capability || 'all',
    content: s.content || '',
    description: s.description || '',
    enabled: s.enabled,
    key: s.key,
    locale: s.locale || '',
    order: s.order ?? 100,
  });
}

async function save(): Promise<void> {
  if (!form.key?.trim()) {
    toast.add({ color: 'error', description: 'Slot-Key fehlt.', title: 'Fehler' });
    return;
  }
  if (!form.content?.trim()) {
    toast.add({ color: 'error', description: 'Inhalt darf nicht leer sein.', title: 'Fehler' });
    return;
  }
  saving.value = true;
  try {
    const payload: LtAiSlotInput = { ...form, locale: form.locale?.trim() || undefined };
    if (editing.value?.id && (editing.value.isOverride || (!editing.value.isSystem && !editing.value.isOverride))) {
      // Update an existing override or custom slot.
      await admin.updateSlot(editing.value.id, payload);
      toast.add({ color: 'success', description: 'Slot aktualisiert.', title: 'Erfolg' });
    } else {
      // Either: overriding a system default for the first time, OR creating a new custom slot.
      await admin.createSlot(payload);
      toast.add({ color: 'success', description: editing.value?.isSystem ? 'Override angelegt.' : 'Slot angelegt.', title: 'Erfolg' });
    }
    startNew();
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    saving.value = false;
  }
}

async function reset(s: LtAiEffectiveSlot): Promise<void> {
  if (!s.id) return;
  try {
    await admin.resetSlot(s.id);
    toast.add({ color: 'success', description: 'Auf System-Standard zurückgesetzt.', title: 'Erfolg' });
    if (editing.value?.id === s.id) startNew();
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

async function remove(s: LtAiEffectiveSlot): Promise<void> {
  if (!s.id) return;
  try {
    await admin.deleteSlot(s.id);
    toast.add({ color: 'success', description: 'Slot gelöscht.', title: 'Erfolg' });
    if (editing.value?.id === s.id) startNew();
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

async function softDeleteSystem(s: LtAiEffectiveSlot): Promise<void> {
  // System default → create a disabled override (hides it for this tenant).
  try {
    await admin.createSlot({ content: s.content, enabled: false, key: s.key, order: s.order });
    toast.add({ color: 'warning', description: `"${s.key}" ist für diesen Tenant deaktiviert.`, title: 'Deaktiviert' });
    await load();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

const systemAndOverrides = computed(() => slots.value.filter((s) => s.isSystem || s.isOverride));
const customs = computed(() => slots.value.filter((s) => !s.isSystem && !s.isOverride));

function formTitle(): string {
  if (!editing.value) return 'Neuen eigenen Slot anlegen';
  if (editing.value.isSystem) return `System-Slot überschreiben: ${editing.value.key}`;
  if (editing.value.isOverride) return `Override bearbeiten: ${editing.value.key}`;
  return `Eigenen Slot bearbeiten: ${editing.value.key}`;
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">KI-Slots</h1>
      <p class="text-muted">
        Bausteine des System-Prompts. Das Framework liefert für jeden Slot sinnvolle Standards — ein Tenant-Eintrag hier
        <strong>überschreibt</strong> ihn nur für deinen Tenant. Eigene Slots ergänzen den Prompt um zusätzliche Anweisungen. Beim Editieren rechts die verfügbaren Platzhalter
        beachten.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div class="space-y-6">
        <!-- Edit form -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ formTitle() }}</h2>
          </template>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField label="Slot-Key" help="z. B. base, permissions, anti_hallucination, oder ein eigener Name">
              <UInput v-model="form.key" placeholder="base" :disabled="!!editing && (editing.isSystem || editing.isOverride)" />
            </UFormField>
            <UFormField label="Modus (capability)">
              <USelectMenu v-model="form.capability" :items="capabilityItems" value-key="value" />
            </UFormField>
            <UFormField label="Sprache (locale)" help="leer = alle Sprachen">
              <UInput v-model="form.locale" placeholder="de" />
            </UFormField>
            <UFormField label="Reihenfolge">
              <UInput v-model.number="form.order" type="number" placeholder="100" />
            </UFormField>
            <UFormField label="Beschreibung" class="sm:col-span-2">
              <UInput v-model="form.description" placeholder="Optional — wofür ist dieser Slot?" />
            </UFormField>
            <UFormField label="Inhalt" class="sm:col-span-2" help="Platzhalter rechts in der Sidebar einsehen.">
              <UTextarea v-model="form.content" :rows="6" placeholder="Du bist …" />
            </UFormField>
            <UFormField label="Aktiv">
              <USwitch v-model="form.enabled" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex gap-2">
              <UButton :icon="editing ? 'i-lucide-save' : 'i-lucide-plus'" :loading="saving" @click="save">
                {{ editing ? 'Speichern' : 'Anlegen' }}
              </UButton>
              <UButton v-if="editing" variant="ghost" icon="i-lucide-x" @click="startNew">Abbrechen</UButton>
            </div>
          </template>
        </UCard>

        <!-- System defaults + overrides -->
        <UCard>
          <template #header><h2 class="font-semibold">System-Slots</h2></template>
          <div v-if="loading" class="py-8 text-center text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
          </div>
          <div v-else class="divide-y">
            <div v-for="s in systemAndOverrides" :key="s.key" class="flex items-start justify-between gap-3 py-3">
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-2 font-medium">
                  <span class="font-mono text-sm">{{ s.key }}</span>
                  <UBadge size="xs" :color="s.isOverride ? 'warning' : 'success'" variant="subtle">
                    {{ s.isOverride ? 'Tenant-Override' : 'System-Standard' }}
                  </UBadge>
                  <UBadge size="xs" color="neutral" variant="subtle">{{ s.capability || 'all' }}</UBadge>
                  <UBadge v-if="s.locale" size="xs" color="info" variant="subtle">{{ s.locale }}</UBadge>
                  <UBadge size="xs" variant="subtle">#{{ s.order }}</UBadge>
                  <UBadge v-if="!s.enabled" size="xs" color="error" variant="subtle">inaktiv</UBadge>
                </p>
                <p v-if="s.description" class="text-xs text-muted">{{ s.description }}</p>
                <p class="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted">{{ s.content }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <UButton size="sm" variant="ghost" icon="i-lucide-pencil" :title="s.isSystem ? 'Override anlegen' : 'Override bearbeiten'" @click="startEdit(s)" />
                <UButton v-if="s.isOverride" size="sm" variant="ghost" color="warning" icon="i-lucide-rotate-ccw" title="Zurücksetzen auf System-Standard" @click="reset(s)" />
                <UButton v-if="s.isSystem" size="sm" variant="ghost" color="error" icon="i-lucide-eye-off" title="Für diesen Tenant deaktivieren" @click="softDeleteSystem(s)" />
              </div>
            </div>
          </div>
        </UCard>

        <!-- Custom tenant slots -->
        <UCard>
          <template #header><h2 class="font-semibold">Eigene Slots (Tenant)</h2></template>
          <div v-if="loading" class="py-8 text-center text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
          </div>
          <p v-else-if="!customs.length" class="py-4 text-center text-sm text-muted">Keine eigenen Slots angelegt.</p>
          <div v-else class="divide-y">
            <div v-for="s in customs" :key="s.id" class="flex items-start justify-between gap-3 py-3">
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-2 font-medium">
                  <span class="font-mono text-sm">{{ s.key }}</span>
                  <UBadge size="xs" color="primary" variant="subtle">Eigener Slot</UBadge>
                  <UBadge size="xs" color="neutral" variant="subtle">{{ s.capability || 'all' }}</UBadge>
                  <UBadge v-if="s.locale" size="xs" color="info" variant="subtle">{{ s.locale }}</UBadge>
                  <UBadge size="xs" variant="subtle">#{{ s.order }}</UBadge>
                  <UBadge v-if="!s.enabled" size="xs" color="warning" variant="subtle">inaktiv</UBadge>
                </p>
                <p v-if="s.description" class="text-xs text-muted">{{ s.description }}</p>
                <p class="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted">{{ s.content }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <UButton size="sm" variant="ghost" icon="i-lucide-pencil" @click="startEdit(s)" />
                <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash" title="Endgültig löschen (nicht wiederherstellbar)" @click="remove(s)" />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Placeholder helper sidebar -->
      <aside class="space-y-4">
        <AiPlaceholderHint />
      </aside>
    </div>
  </div>
</template>
