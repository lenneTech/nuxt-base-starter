<script setup lang="ts">
// ============================================================================
// User-facing AI prompt snippets ("Vorlagen") settings:
//   - list every snippet visible to the current user (own + tenant + global)
//   - CRUD for own snippets
//   - share with the whole tenant (no admin role needed)
//   - admins additionally see / can author `global` snippets
//
// Owner-only mutations are enforced server-side; admins can edit any snippet
// via the standard admin pipeline.
// ============================================================================
import type { LtAiPromptSnippet, LtAiPromptSnippetInput } from '@lenne.tech/nuxt-extensions';

useHead({ title: 'KI-Vorlagen' });

const { user } = useLtAuth();
const toast = useToast();
const { create, error, load, loading, remove, snippets, update } = useLtAiSnippets();

const isAdmin = computed(() => Array.isArray(user.value?.roles) && user.value!.roles!.includes('admin'));
const myUserId = computed(() => user.value?.id);

const scopeItems = computed(() => {
  const items = [
    { label: 'Nur für mich', value: 'user' },
    { label: 'Tenant teilen', value: 'tenant' },
  ];
  if (isAdmin.value) {
    items.push({ label: 'Global (alle)', value: 'global' });
  }
  return items;
});

function emptyForm(): LtAiPromptSnippetInput {
  return { content: '', description: '', enabled: true, icon: '', name: '', order: 100, scope: 'user' };
}

const form = reactive<LtAiPromptSnippetInput>(emptyForm());
const editId = ref<null | string>(null);
const saving = ref(false);

onMounted(load);

function canMutate(s: LtAiPromptSnippet): boolean {
  return isAdmin.value || s.ownerId === myUserId.value;
}

function reset(): void {
  editId.value = null;
  Object.assign(form, emptyForm());
}

function edit(s: LtAiPromptSnippet): void {
  editId.value = s.id;
  Object.assign(form, {
    content: s.content || '',
    description: s.description || '',
    enabled: s.enabled !== false,
    icon: s.icon || '',
    name: s.name || '',
    order: s.order ?? 100,
    scope: s.scope || 'user',
  });
}

async function save(): Promise<void> {
  if (!form.name?.trim()) {
    toast.add({ color: 'error', description: 'Bitte einen Namen angeben.', title: 'Fehler' });
    return;
  }
  if (!form.content?.trim()) {
    toast.add({ color: 'error', description: 'Bitte einen Inhalt angeben.', title: 'Fehler' });
    return;
  }
  saving.value = true;
  try {
    const payload: LtAiPromptSnippetInput = { ...form };
    if (editId.value) {
      await update(editId.value, payload);
      toast.add({ color: 'success', description: 'Vorlage aktualisiert.', title: 'Erfolg' });
    } else {
      await create(payload);
      toast.add({ color: 'success', description: 'Vorlage angelegt.', title: 'Erfolg' });
    }
    reset();
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    saving.value = false;
  }
}

async function onDelete(s: LtAiPromptSnippet): Promise<void> {
  try {
    await remove(s.id);
    toast.add({ color: 'success', description: 'Vorlage gelöscht.', title: 'Erfolg' });
    if (editId.value === s.id) {
      reset();
    }
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

const grouped = computed(() => ({
  user: snippets.value.filter((s) => s.scope === 'user'),
  tenant: snippets.value.filter((s) => s.scope === 'tenant'),
  global: snippets.value.filter((s) => s.scope === 'global'),
}));
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">KI-Vorlagen</h1>
      <p class="text-muted">
        Schnelle Textbausteine, die du im KI-Chat per Klick einfügen kannst. Sichtbarkeit: <strong>Nur für mich</strong>, <strong>Tenant</strong> (alle Mitglieder deines Tenants)
        oder <strong>Global</strong> (alle Nutzer — nur Admins).
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-alert-circle" :description="error" />

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ editId ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}</h2>
      </template>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="Name">
          <UInput v-model="form.name" placeholder="z. B. Kurze freundliche Antwort" data-test="snippet-name" />
        </UFormField>
        <UFormField label="Sichtbarkeit">
          <USelectMenu v-model="form.scope" :items="scopeItems" value-key="value" data-test="snippet-scope" />
        </UFormField>
        <UFormField label="Beschreibung" class="sm:col-span-2">
          <UInput v-model="form.description" placeholder="Optional — wofür ist diese Vorlage?" />
        </UFormField>
        <UFormField label="Inhalt" class="sm:col-span-2" help="Wird beim Anklicken in den Chat-Eingabebereich eingefügt.">
          <UTextarea v-model="form.content" :rows="4" placeholder="Beispiel: Schreibe eine kurze, freundliche Antwort an den Kunden zu …" data-test="snippet-content" />
        </UFormField>
        <UFormField label="Icon" help="Lucide-Name (z. B. i-lucide-mail) oder ein Emoji">
          <UInput v-model="form.icon" placeholder="i-lucide-mail" />
        </UFormField>
        <UFormField label="Reihenfolge">
          <UInput v-model.number="form.order" type="number" placeholder="100" />
        </UFormField>
        <UFormField label="Aktiv">
          <USwitch v-model="form.enabled" />
        </UFormField>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <UButton :icon="editId ? 'i-lucide-save' : 'i-lucide-plus'" :loading="saving" data-test="snippet-save" @click="save">
            {{ editId ? 'Speichern' : 'Vorlage anlegen' }}
          </UButton>
          <UButton v-if="editId" variant="ghost" icon="i-lucide-x" @click="reset"> Abbrechen </UButton>
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">Sichtbare Vorlagen</h2></template>
      <div v-if="loading" class="py-8 text-center text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <div v-else-if="!snippets.length" class="py-8 text-center text-muted">Noch keine Vorlagen. Lege oben deine erste an.</div>
      <div v-else class="space-y-6">
        <template v-for="(group, key) in grouped" :key="key">
          <div v-if="group.length">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              {{ key === 'user' ? 'Eigene' : key === 'tenant' ? 'Geteilt (Tenant)' : 'Global' }}
            </p>
            <div class="divide-y">
              <div v-for="s in group" :key="s.id" class="flex items-start justify-between gap-3 py-3" data-test="snippet-row">
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-2 font-medium">
                    <UIcon v-if="s.icon && s.icon.startsWith('i-')" :name="s.icon" class="size-4" />
                    <span v-else-if="s.icon">{{ s.icon }}</span>
                    <span>{{ s.name }}</span>
                    <UBadge size="xs" variant="subtle">#{{ s.order ?? 100 }}</UBadge>
                    <UBadge v-if="s.enabled === false" size="xs" color="warning" variant="subtle">inaktiv</UBadge>
                  </p>
                  <p v-if="s.description" class="text-xs text-muted">{{ s.description }}</p>
                  <p class="mt-1 line-clamp-2 text-xs text-muted">{{ s.content }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <UButton v-if="canMutate(s)" size="sm" variant="ghost" icon="i-lucide-pencil" @click="edit(s)" />
                  <UButton v-if="canMutate(s)" size="sm" variant="ghost" color="error" icon="i-lucide-trash" @click="onDelete(s)" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
