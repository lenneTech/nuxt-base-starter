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

const schema = v.object({
  baseUrl: v.pipe(v.string('Basis-URL ist erforderlich'), v.url('Ungültige URL')),
  model: v.pipe(v.string('Modell ist erforderlich'), v.minLength(1, 'Modell ist erforderlich')),
  name: v.pipe(v.string('Name ist erforderlich'), v.minLength(1, 'Name ist erforderlich')),
});

async function onSubmit(_event: FormSubmitEvent<v.InferOutput<typeof schema>>): Promise<void> {
  loading.value = true;
  try {
    const input: LtAiConnectionInput = {
      baseUrl: form.baseUrl,
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
        <UFormField label="Basis-URL" name="baseUrl" required help="OpenAI-kompatibler Endpoint, z.B. https://llm.example.com/v1">
          <UInput v-model="form.baseUrl" placeholder="https://llm.example.com/v1" />
        </UFormField>
        <UFormField label="Modell" name="model" required>
          <UInput v-model="form.model" placeholder="z.B. gpt-oss-120b" />
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
