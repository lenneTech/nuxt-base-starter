<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import * as v from 'valibot';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { signUp, signIn, registerPasskey } = useLtAuth();

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

// Form state - using refs for direct v-model binding
const formState = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
});

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

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(): Promise<void> {
  // Validate
  const result = v.safeParse(schema, formState);
  if (!result.success) {
    const firstError = result.issues[0];
    toast.add({
      color: 'error',
      description: firstError.message,
      title: 'Validierungsfehler',
    });
    return;
  }

  loading.value = true;

  try {
    // Step 1: Sign up
    const signUpResult = await signUp.email({
      email: formState.email,
      name: formState.name,
      password: formState.password,
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
      email: formState.email,
      password: formState.password,
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
      <div class="flex flex-col items-center gap-4">
        <UIcon name="i-lucide-user-plus" class="size-12 text-primary" />
        <h1 class="text-2xl font-semibold">Registrieren</h1>
      </div>

      <form class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
        <UFormField label="Name" name="name" required class="w-full">
          <UInput
            v-model="formState.name"
            name="name"
            type="text"
            placeholder="Name eingeben"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="E-Mail" name="email" required class="w-full">
          <UInput
            v-model="formState.email"
            name="email"
            type="email"
            placeholder="E-Mail eingeben"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Passwort" name="password" required class="w-full">
          <UInput
            v-model="formState.password"
            name="password"
            type="password"
            placeholder="Passwort eingeben"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Passwort bestätigen" name="confirmPassword" required class="w-full">
          <UInput
            v-model="formState.confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Passwort wiederholen"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>

        <UButton type="submit" block :loading="loading">
          Konto erstellen
        </UButton>
      </form>

      <p class="mt-4 text-center text-sm text-muted">
        Bereits ein Konto?
        <ULink to="/auth/login" class="text-primary font-medium">Anmelden</ULink>
      </p>
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
