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
const route = useRoute();
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
const token = computed<string>(() => {
  const queryToken = route.query.token;
  return typeof queryToken === 'string' ? queryToken : '';
});

const isTokenValid = computed<boolean>(() => token.value.length > 0);
const loading = ref<boolean>(false);
const resetSuccess = ref<boolean>(false);

const fields: AuthFormField[] = [
  {
    label: 'Neues Passwort',
    name: 'password',
    placeholder: 'Neues Passwort eingeben',
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
    password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
  }),
  v.forward(
    v.partialCheck([['password'], ['confirmPassword']], (input) => input.password === input.confirmPassword, 'Passwörter stimmen nicht überein'),
    ['confirmPassword'],
  ),
);

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(() => {
  if (!isTokenValid.value) {
    toast.add({
      color: 'error',
      description: 'Der Link zum Zurücksetzen des Passworts ist ungültig oder fehlt.',
      title: 'Ungültiger Link',
    });
  }
});

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    const { error } = await authClient.resetPassword({
      newPassword: payload.data.password,
      token: token.value,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Passwort konnte nicht zurückgesetzt werden',
        title: 'Fehler',
      });
      return;
    }

    resetSuccess.value = true;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <template v-if="resetSuccess">
      <div class="flex flex-col items-center gap-6">
        <UIcon name="i-lucide-check-circle" class="size-16 text-success" />
        <div class="text-center">
          <h2 class="text-xl font-semibold">Passwort zurückgesetzt</h2>
          <p class="mt-2 text-sm text-muted">Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
        </div>

        <UButton to="/auth/login" block> Zur Anmeldung </UButton>
      </div>
    </template>

    <template v-else>
      <UAlert
        v-if="!isTokenValid"
        color="error"
        description="Der Link zum Zurücksetzen des Passworts ist ungültig oder fehlt. Bitte fordere einen neuen Link an."
        icon="i-lucide-alert-triangle"
        title="Ungültiger Link"
        class="mb-4"
      />

      <UAuthForm
        :schema="schema"
        title="Neues Passwort"
        icon="i-lucide-shield-check"
        :fields="fields"
        :loading="loading"
        :submit="{
          label: 'Passwort speichern',
          block: true,
          disabled: !isTokenValid,
        }"
        @submit="onSubmit"
      >
        <template #footer>
          <p class="text-center text-sm text-muted">
            <ULink to="/auth/forgot-password" class="text-primary font-medium"> Neuen Link anfordern </ULink>
          </p>
        </template>
      </UAuthForm>
    </template>
  </UPageCard>
</template>
