<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
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
const passkeyLoading = ref<boolean>(false);

const fields: AuthFormField[] = [
  {
    label: 'E-Mail',
    name: 'email',
    placeholder: 'E-Mail eingeben',
    required: true,
    type: 'email',
  },
  {
    label: 'Passwort',
    name: 'password',
    placeholder: 'Passwort eingeben',
    required: true,
    type: 'password',
  },
];

const schema = v.object({
  email: v.pipe(v.string('E-Mail ist erforderlich'), v.email('Bitte eine gültige E-Mail eingeben')),
  password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(5, 'Mindestens 5 Zeichen erforderlich')),
});

type Schema = InferOutput<typeof schema>;

async function onPasskeyLogin(): Promise<void> {
  passkeyLoading.value = true;

  try {
    const { error } = await authClient.signIn.passkey();

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Passkey-Anmeldung fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    await navigateTo('/app');
  } finally {
    passkeyLoading.value = false;
  }
}

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    const { error } = await authClient.signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Anmeldung fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    await navigateTo('/app');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <UAuthForm
      :schema="schema"
      title="Anmelden"
      icon="i-lucide-user"
      :fields="fields"
      :loading="loading"
      :submit="{
        label: 'Anmelden',
        block: true,
      }"
      @submit="onSubmit"
    >
      <template #password-hint>
        <ULink to="/auth/forgot-password" class="text-primary font-medium" tabindex="-1">Passwort vergessen?</ULink>
      </template>

      <template #footer>
        <div class="flex flex-col gap-4">
          <USeparator label="oder" />

          <UButton block color="neutral" variant="outline" icon="i-lucide-key" :loading="passkeyLoading" @click="onPasskeyLogin"> Mit Passkey anmelden </UButton>

          <p class="text-center text-sm text-muted">
            Noch kein Konto?
            <ULink to="/auth/register" class="text-primary font-medium">Registrieren</ULink>
          </p>
        </div>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
