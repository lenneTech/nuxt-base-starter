<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// ============================================================================
// Types
// ============================================================================
interface AuthResponse {
  data?: {
    token?: string | null;
    user?: Record<string, unknown>;
  } | null;
  error?: {
    code?: string;
    message?: string;
    status?: number;
  } | null;
}

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { signUp, signIn, registerPasskey, features, clearUser } = useLtAuth();
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

const requireTerms = computed(() => features.value.signUpChecks === true);

const baseFields: AuthFormField[] = [
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

const fields = computed<AuthFormField[]>(() => {
  if (!requireTerms.value) {
    return baseFields;
  }
  return [
    ...baseFields,
    {
      label: '',
      name: 'termsAccepted',
      required: true,
      type: 'checkbox',
    },
  ];
});

const baseSchema = v.pipe(
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

const termsSchema = v.pipe(
  v.object({
    confirmPassword: v.pipe(v.string('Passwortbestätigung ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
    email: v.pipe(v.string('E-Mail ist erforderlich'), v.email('Bitte eine gültige E-Mail eingeben')),
    name: v.pipe(v.string('Name ist erforderlich'), v.minLength(2, 'Mindestens 2 Zeichen erforderlich')),
    password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
    termsAccepted: v.pipe(v.optional(v.boolean(), false), v.literal(true, 'Bitte akzeptiere die AGB und Datenschutzerklärung')),
  }),
  v.forward(
    v.partialCheck([['password'], ['confirmPassword']], (input) => input.password === input.confirmPassword, 'Passwörter stimmen nicht überein'),
    ['confirmPassword'],
  ),
);

const schema = computed(() => (requireTerms.value ? termsSchema : baseSchema));

type Schema = InferOutput<typeof baseSchema> | InferOutput<typeof termsSchema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    // Step 1: Sign up
    const signUpResult = (await signUp.email({
      email: payload.data.email,
      name: payload.data.name,
      password: payload.data.password,
      ...(requireTerms.value ? { termsAndPrivacyAccepted: true } : {}),
    })) as AuthResponse;

    if (signUpResult.error) {
      const errorMessage = signUpResult.error.message || 'Registrierung fehlgeschlagen';
      toast.add({
        color: 'error',
        description: translateError(errorMessage),
        title: 'Registrierung fehlgeschlagen',
      });
      return;
    }

    // If email verification is enabled, clear auth state and redirect to verify-email page
    // The backend revokes the session, but we also clear the frontend state to prevent
    // manual navigation to protected routes
    if (features.value.emailVerification) {
      clearUser();
      toast.add({
        color: 'success',
        description: 'Bitte überprüfe dein Postfach und bestätige deine E-Mail-Adresse.',
        title: 'Konto erstellt!',
      });
      await navigateTo({ path: '/auth/verify-email', query: { email: payload.data.email, fromRegister: 'true' } });
      return;
    }

    // Step 2: Sign in to create session (required for passkey registration)
    const signInResult = (await signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    })) as AuthResponse;

    const signInError = signInResult.error;

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
        <template v-if="requireTerms" #termsAccepted-field="slotProps">
          <UCheckbox v-model="(slotProps as any).state.termsAccepted">
            <template #label>
              <span class="text-sm">
                Ich akzeptiere die
                <ULink to="/legal/terms" class="text-primary font-medium" target="_blank">AGB</ULink>
                und
                <ULink to="/legal/privacy" class="text-primary font-medium" target="_blank">Datenschutzerklärung</ULink>
              </span>
            </template>
          </UCheckbox>
        </template>

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
