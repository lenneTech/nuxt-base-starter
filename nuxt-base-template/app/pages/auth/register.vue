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
const { signUp, signIn, registerPasskey } = useLtAuth();
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
const showPasskeyPrompt = ref<boolean>(false);
const passkeyLoading = ref<boolean>(false);

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
      const errorMessage = signUpError.message || 'Registrierung fehlgeschlagen';
      toast.add({
        color: 'error',
        description: translateError(errorMessage),
        title: 'Registrierung fehlgeschlagen',
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
      description: 'Dein Konto wurde erfolgreich erstellt',
      title: 'Willkommen!',
    });

    // Show passkey prompt after successful registration + login
    showPasskeyPrompt.value = true;
  } finally {
    loading.value = false;
  }
}

async function addPasskey(): Promise<void> {
  passkeyLoading.value = true;

  try {
    // Use registerPasskey from composable which properly handles challengeId
    const result = await registerPasskey('Mein Gerät');

    if (!result.success) {
      toast.add({
        color: 'error',
        description: result.error || 'Passkey konnte nicht hinzugefügt werden',
        title: 'Fehler',
      });
      // Still navigate to app even if passkey failed
      await navigateTo('/app');
      return;
    }

    toast.add({
      color: 'success',
      description: 'Passkey wurde erfolgreich hinzugefügt',
      title: 'Erfolg',
    });

    await navigateTo('/app');
  } finally {
    passkeyLoading.value = false;
  }
}

async function skipPasskey(): Promise<void> {
  await navigateTo('/app');
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <template v-if="!showPasskeyPrompt">
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
    </template>

    <template v-else>
      <div class="flex flex-col items-center gap-6">
        <UIcon name="i-lucide-key" class="size-16 text-primary" />
        <div class="text-center">
          <h2 class="text-xl font-semibold">Passkey hinzufügen?</h2>
          <p class="mt-2 text-sm text-muted">Mit einem Passkey kannst du dich schnell und sicher ohne Passwort anmelden.</p>
        </div>

        <div class="flex w-full flex-col gap-3">
          <UButton block :loading="passkeyLoading" @click="addPasskey"> Passkey hinzufügen </UButton>
          <UButton block variant="outline" color="neutral" @click="skipPasskey"> Später einrichten </UButton>
        </div>
      </div>
    </template>
  </UPageCard>
</template>
