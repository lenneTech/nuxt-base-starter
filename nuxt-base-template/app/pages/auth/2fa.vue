<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

import { authClient } from '~/lib/auth-client';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);
const useBackupCode = ref<boolean>(false);
const trustDevice = ref<boolean>(false);

const schema = v.object({
  code: v.pipe(v.string('Code ist erforderlich'), v.minLength(6, 'Code muss mindestens 6 Zeichen haben')),
});

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    if (useBackupCode.value) {
      const { error } = await authClient.twoFactor.verifyBackupCode({
        code: payload.data.code,
      });

      if (error) {
        toast.add({
          color: 'error',
          description: error.message || 'Backup-Code ungültig',
          title: 'Fehler',
        });
        return;
      }
    } else {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: payload.data.code,
        trustDevice: trustDevice.value,
      });

      if (error) {
        toast.add({
          color: 'error',
          description: error.message || 'Code ungültig',
          title: 'Fehler',
        });
        return;
      }
    }

    await navigateTo('/app');
  } finally {
    loading.value = false;
  }
}

function toggleBackupCode(): void {
  useBackupCode.value = !useBackupCode.value;
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <div class="flex flex-col gap-6">
      <div class="flex flex-col items-center gap-2">
        <UIcon name="i-lucide-shield-check" class="size-12 text-primary" />
        <h1 class="text-xl font-semibold">Zwei-Faktor-Authentifizierung</h1>
        <p class="text-center text-sm text-muted">
          {{ useBackupCode ? 'Gib einen deiner Backup-Codes ein' : 'Gib den 6-stelligen Code aus deiner Authenticator-App ein' }}
        </p>
      </div>

      <UForm :schema="schema" class="flex flex-col gap-4" @submit="onSubmit">
        <UFormField :label="useBackupCode ? 'Backup-Code' : 'Authentifizierungscode'" name="code">
          <UInput
            name="code"
            :placeholder="useBackupCode ? 'Backup-Code eingeben' : '000000'"
            size="lg"
            class="text-center font-mono text-lg tracking-widest"
            autocomplete="one-time-code"
          />
        </UFormField>

        <UCheckbox v-if="!useBackupCode" v-model="trustDevice" label="Diesem Gerät vertrauen" />

        <UButton type="submit" block :loading="loading"> Verifizieren </UButton>
      </UForm>

      <div class="flex flex-col items-center gap-2">
        <UButton variant="link" color="neutral" @click="toggleBackupCode">
          {{ useBackupCode ? 'Authenticator-Code verwenden' : 'Backup-Code verwenden' }}
        </UButton>

        <ULink to="/auth/login" class="text-sm text-muted hover:text-primary"> Zurück zur Anmeldung </ULink>
      </div>
    </div>
  </UPageCard>
</template>
