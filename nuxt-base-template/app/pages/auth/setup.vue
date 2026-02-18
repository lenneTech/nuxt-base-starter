<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { initSetup } = useSystemSetup();
const { translateError } = useLtErrorTranslation();

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

const fields: AuthFormField[] = [
  {
    label: 'Name',
    name: 'name',
    placeholder: 'Name eingeben',
    required: true,
    type: 'text',
  },
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
  {
    label: 'Passwort bestätigen',
    name: 'confirmPassword',
    placeholder: 'Passwort wiederholen',
    required: true,
    type: 'password',
  },
];

const schema = v.pipe(
  v.object({
    confirmPassword: v.pipe(v.string('Passwortbestätigung ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
    email: v.pipe(v.string('E-Mail ist erforderlich'), v.email('Bitte eine gültige E-Mail eingeben')),
    name: v.pipe(v.string('Name ist erforderlich'), v.minLength(2, 'Mindestens 2 Zeichen erforderlich')),
    password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
  }),
  v.forward(
    v.partialCheck([['password'], ['confirmPassword']], (input) => input.password === input.confirmPassword, 'Passwörter stimmen nicht überein'),
    ['confirmPassword'],
  ),
);

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    await initSetup({
      email: payload.data.email,
      name: payload.data.name,
      password: payload.data.password,
    });

    toast.add({
      color: 'success',
      description: 'Das System wurde erfolgreich eingerichtet.',
      title: 'Administrator-Account erstellt',
    });

    await navigateTo('/auth/login');
  } catch (err: unknown) {
    toast.add({
      color: 'error',
      description: translateError(err instanceof Error ? err.message : 'Einrichtung fehlgeschlagen'),
      title: 'Fehler',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <UAuthForm
      :schema="schema"
      title="System einrichten"
      icon="i-lucide-shield-check"
      :fields="fields"
      :loading="loading"
      :submit="{
        label: 'System einrichten',
        block: true,
      }"
      @submit="onSubmit"
    >
      <template #description>
        <p class="text-sm text-muted">Erstelle den ersten Administrator-Account, um das System zu starten.</p>
      </template>

      <template #footer>
        <p class="text-center text-sm text-muted">
          Bereits eingerichtet?
          <ULink to="/auth/login" class="text-primary font-medium">Anmelden</ULink>
        </p>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
