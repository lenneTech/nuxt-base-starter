<script setup lang="ts">
// ============================================================================
// Create/edit an AI connection (admin). Capability flags are tri-state:
// "Automatisch erkennen" leaves them undefined so the backend auto-detects
// them by probing the endpoint. The API key uses patch semantics (empty leaves
// it unchanged on edit).
// ============================================================================
import type { LtAiConnection, LtAiConnectionInput } from '@lenne.tech/nuxt-extensions';
import type { FormSubmitEvent } from '@nuxt/ui';

import * as v from 'valibot';

const props = defineProps<{
  connection?: LtAiConnection;
}>();

const emit = defineEmits<{
  close: [saved?: boolean];
}>();

const admin = useLtAiAdmin();
const toast = useToast();
const loading = ref(false);
const isEdit = computed(() => !!props.connection?.id);

type TriState = 'auto' | 'no' | 'yes';
const triItems = [
  { label: 'Automatisch erkennen', value: 'auto' },
  { label: 'Ja', value: 'yes' },
  { label: 'Nein', value: 'no' },
];

// Provider backends. `openai-compatible` covers hosted (external) and local
// (e.g. Ollama) endpoints; `claude-cli` drives the local Claude Code CLI and
// needs no base URL (register ClaudeCliProvider on the backend factory).
const providerItems = [
  { label: 'OpenAI-kompatibel (extern / lokal)', value: 'openai-compatible' },
  { label: 'Claude Code CLI (lokal)', value: 'claude-cli' },
];

function toTri(value?: boolean): TriState {
  return value === undefined ? 'auto' : value ? 'yes' : 'no';
}
function fromTri(value: TriState): boolean | undefined {
  return value === 'auto' ? undefined : value === 'yes';
}

const form = reactive({
  apiKey: '',
  baseUrl: props.connection?.baseUrl ?? '',
  defaultMaxTokens: props.connection?.defaultMaxTokens,
  isDefault: props.connection?.isDefault ?? false,
  model: props.connection?.model ?? '',
  name: props.connection?.name ?? '',
  providerType: props.connection?.providerType ?? 'openai-compatible',
  supportsJsonResponse: toTri(props.connection?.supportsJsonResponse),
  supportsNativeTools: toTri(props.connection?.supportsNativeTools),
});

// CLI providers don't use a base URL; OpenAI-compatible ones require a valid URL.
const isCliProvider = computed(() => form.providerType === 'claude-cli');

const schema = v.object({
  // Allow empty (CLI) or a valid URL; the "required for OpenAI-compatible" rule is
  // enforced in onSubmit so the message can reference the chosen provider.
  baseUrl: v.union([v.literal(''), v.pipe(v.string(), v.url('Ungültige URL'))]),
  model: v.pipe(v.string('Modell ist erforderlich'), v.minLength(1, 'Modell ist erforderlich')),
  name: v.pipe(v.string('Name ist erforderlich'), v.minLength(1, 'Name ist erforderlich')),
});

async function onSubmit(_event: FormSubmitEvent<v.InferOutput<typeof schema>>): Promise<void> {
  if (!isCliProvider.value && !form.baseUrl) {
    toast.add({ color: 'error', description: 'Basis-URL ist für OpenAI-kompatible Verbindungen erforderlich.', title: 'Fehler' });
    return;
  }
  loading.value = true;
  try {
    const input: LtAiConnectionInput = {
      // CLI backends ignore the base URL; send a stable placeholder so the
      // required backend field is satisfied.
      baseUrl: isCliProvider.value ? form.baseUrl || 'cli://claude-code' : form.baseUrl,
      defaultMaxTokens: form.defaultMaxTokens,
      isDefault: form.isDefault,
      model: form.model,
      name: form.name,
      providerType: form.providerType,
      supportsJsonResponse: fromTri(form.supportsJsonResponse),
      supportsNativeTools: fromTri(form.supportsNativeTools),
    };
    // Patch semantics: only send apiKey when the admin typed one.
    if (form.apiKey) {
      input.apiKey = form.apiKey;
    }
    if (isEdit.value && props.connection?.id) {
      await admin.updateConnection(props.connection.id, input);
    } else {
      await admin.createConnection(input);
    }
    toast.add({ color: 'success', description: 'Verbindung gespeichert.', title: 'Erfolg' });
    emit('close', true);
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal :title="isEdit ? 'Verbindung bearbeiten' : 'Verbindung hinzufügen'" :close="{ onClick: () => emit('close', false) }">
    <template #body>
      <UForm :schema="schema" :state="form" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name" required>
          <UInput v-model="form.name" placeholder="z.B. Default LLM" />
        </UFormField>
        <UFormField label="Provider" name="providerType" help="Backend-Art der Verbindung">
          <USelectMenu v-model="form.providerType" :items="providerItems" value-key="value" class="w-full" />
        </UFormField>
        <UFormField
          v-if="!isCliProvider"
          label="Basis-URL"
          name="baseUrl"
          required
          help="OpenAI-kompatibler Endpoint, z.B. https://llm.example.com/v1 oder http://localhost:11434/v1 (Ollama)"
        >
          <UInput v-model="form.baseUrl" placeholder="https://llm.example.com/v1" />
        </UFormField>
        <UFormField label="Modell" name="model" required :help="isCliProvider ? 'Claude-Alias, z.B. sonnet, opus oder haiku' : undefined">
          <UInput v-model="form.model" :placeholder="isCliProvider ? 'z.B. sonnet' : 'z.B. gpt-oss-120b'" />
        </UFormField>
        <UFormField label="API-Key" name="apiKey" :help="isEdit ? 'Leer lassen, um den vorhandenen Key zu behalten' : 'Optional — wird verschlüsselt gespeichert'">
          <UInput v-model="form.apiKey" type="password" :placeholder="isEdit ? '•••••••• (unverändert)' : 'sk-…'" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="JSON-Modus" name="supportsJsonResponse">
            <USelectMenu v-model="form.supportsJsonResponse" :items="triItems" value-key="value" />
          </UFormField>
          <UFormField label="Native Tools" name="supportsNativeTools">
            <USelectMenu v-model="form.supportsNativeTools" :items="triItems" value-key="value" />
          </UFormField>
        </div>
        <UFormField label="Max. Tokens" name="defaultMaxTokens">
          <UInput v-model.number="form.defaultMaxTokens" type="number" placeholder="4096" />
        </UFormField>
        <UCheckbox v-model="form.isDefault" label="Als globalen Standard setzen" />
        <div class="flex justify-end gap-3 pt-2">
          <UButton color="neutral" variant="outline" @click="emit('close', false)"> Abbrechen </UButton>
          <UButton type="submit" color="primary" :loading="loading"> Speichern </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
