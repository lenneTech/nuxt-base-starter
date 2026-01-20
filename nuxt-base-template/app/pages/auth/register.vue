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
const { signUp, signIn } = useBetterAuth();

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
    // Step 1: Sign up
    const signUpResult = await signUp.email({
      email: payload.data.email,
      name: payload.data.name,
      password: payload.data.password,
    });

    const signUpError = 'error' in signUpResult ? signUpResult.error : null;

    if (signUpError) {
      toast.add({
        color: 'error',
        description: signUpError.message || 'Registrierung fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    // Step 2: Sign in to create session (required for passkey registration)
    const signInResult = await signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    });

    const signInError = 'error' in signInResult ? signInResult.error : null;

    if (signInError) {
      // Sign-up was successful but sign-in failed - still show success and redirect
      toast.add({
        color: 'success',
        description: 'Dein Konto wurde erstellt. Bitte melde dich an.',
        title: 'Willkommen!',
      });
      await navigateTo('/auth/login');
      return;
    }

    toast.add({
      color: 'success',
      description: 'Dein Konto wurde erfolgreich erstellt. Du kannst Passkeys später in den Sicherheitseinstellungen hinzufügen.',
      title: 'Willkommen!',
    });

    // Navigate to app - passkeys can be added later in security settings
    // Note: Immediate passkey registration after sign-up is currently not supported
    // due to session handling differences between nest-server and Better Auth
    await navigateTo('/app', { external: true });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <UAuthForm
      :schema="schema"
      title="Registrieren"
      icon="i-lucide-user-plus"
      :fields="fields"
      :loading="loading"
      :submit="{
        label: 'Konto erstellen',
        block: true,
      }"
      @submit="onSubmit"
    >
      <template #footer>
        <p class="text-center text-sm text-muted">
          Bereits ein Konto?
          <ULink to="/auth/login" class="text-primary font-medium">Anmelden</ULink>
        </p>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
