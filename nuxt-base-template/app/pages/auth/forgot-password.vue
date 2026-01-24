<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// Auth client from @lenne.tech/nuxt-extensions (auto-imported as ltAuthClient)
const authClient = ltAuthClient;

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const config = useRuntimeConfig();

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
const emailSent = ref<boolean>(false);

const fields: AuthFormField[] = [
  {
    label: 'E-Mail',
    name: 'email',
    placeholder: 'E-Mail eingeben',
    required: true,
    type: 'email',
  },
];

const schema = v.object({
  email: v.pipe(v.string('E-Mail ist erforderlich'), v.email('Bitte eine gültige E-Mail eingeben')),
});

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    const { error } = await authClient.requestPasswordReset({
      email: payload.data.email,
      redirectTo: `${config.public.siteUrl}/auth/reset-password`,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Anfrage fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    emailSent.value = true;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <template v-if="!emailSent">
      <UAuthForm
        :schema="schema"
        title="Passwort vergessen"
        icon="i-lucide-lock"
        :fields="fields"
        :loading="loading"
        :submit="{
          label: 'Link anfordern',
          block: true,
        }"
        @submit="onSubmit"
      >
        <template #description>
          <p class="text-sm text-muted">Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
        </template>

        <template #footer>
          <p class="text-center text-sm text-muted">
            Zurück zur
            <ULink to="/auth/login" class="text-primary font-medium">Anmeldung</ULink>
          </p>
        </template>
      </UAuthForm>
    </template>

    <template v-else>
      <div class="flex flex-col items-center gap-6">
        <UIcon name="i-lucide-mail-check" class="size-16 text-success" />
        <div class="text-center">
          <h2 class="text-xl font-semibold">E-Mail gesendet</h2>
          <p class="mt-2 text-sm text-muted">Wir haben dir eine E-Mail mit einem Link zum Zurücksetzen deines Passworts gesendet. Bitte überprüfe auch deinen Spam-Ordner.</p>
        </div>

        <UButton to="/auth/login" variant="outline" color="neutral"> Zurück zur Anmeldung </UButton>
      </div>
    </template>
  </UPageCard>
</template>
