<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// Auth client from @lenne.tech/nuxt-extensions
const authClient = useLtAuthClient();

// ============================================================================
// Composables
// ============================================================================
const config = useRuntimeConfig();
const { translateError } = useLtErrorTranslation();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'Passwort vergessen',
});

// ============================================================================
// Variables
// ============================================================================
const apiBase = import.meta.dev ? '/api/iam' : `${config.public.apiUrl || 'http://localhost:3000'}/iam`;

const loading = ref<boolean>(false);
const emailSent = ref<boolean>(false);
const submitError = ref<string>('');
const submittedEmail = ref<string>('');
const successHeading = ref<HTMLElement | null>(null);

const resending = ref<boolean>(false);
const resendCooldown = ref<number>(0);
const cooldownSeconds = ref<number>(60);
let cooldownInterval: null | ReturnType<typeof setInterval> = null;

const fields: AuthFormField[] = [
  {
    // Without this NuxtUI defaults `autocomplete` to "off" — on the one form where a
    // user who has lost their credentials most needs the browser's help.
    autocomplete: 'email',
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
async function requestResetLink(email: string): Promise<boolean> {
  const { error } = await authClient.requestPasswordReset({
    email,
    // Not a template literal over the config value — see `utils/app-origin.ts`.
    redirectTo: appUrl('/auth/reset-password', config.public.siteUrl),
  });

  if (error) {
    // Not `translateError(...) || fallback`: that fallback is unreachable. `translateError`
    // hands back the original message when it cannot translate, so it only returns an empty
    // string for empty input — which is the case tested here, before translating.
    submitError.value = error.message ? translateError(error.message) : 'Die Anfrage konnte nicht verarbeitet werden.';
    return false;
  }

  submitError.value = '';
  return true;
}

async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;
  submitError.value = '';

  try {
    if (await requestResetLink(payload.data.email)) {
      submittedEmail.value = payload.data.email;
      emailSent.value = true;
      startCooldown(cooldownSeconds.value);
      // The form unmounts on success. Without moving focus it lands on <body>, so a
      // keyboard or screen-reader user loses their place entirely.
      await nextTick();
      successHeading.value?.focus();
    }
  } catch {
    // Better Auth normally returns `{ error }` rather than throwing, but a transport
    // failure or an exception in the response path would otherwise stop the spinner
    // and leave the user with a form that silently did nothing.
    submitError.value = 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.';
  } finally {
    loading.value = false;
  }
}

async function resendResetLink(): Promise<void> {
  if (!submittedEmail.value || resendCooldown.value > 0) {
    return;
  }

  resending.value = true;

  try {
    if (await requestResetLink(submittedEmail.value)) {
      startCooldown(cooldownSeconds.value);
    }
  } catch {
    submitError.value = 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.';
  } finally {
    resending.value = false;
  }
}

/** Back to the form with the address kept, so a typo costs one edit rather than a detour. */
function useDifferentEmail(): void {
  emailSent.value = false;
  submitError.value = '';
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
  resendCooldown.value = 0;
}

function startCooldown(seconds: number): void {
  resendCooldown.value = seconds;
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
      if (cooldownInterval) clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
  }, 1000);
}

// ============================================================================
// Lifecycle
// ============================================================================
onMounted(async () => {
  try {
    const features = await $fetch<Record<string, boolean | number | string[]>>(`${apiBase}/features`);
    if (typeof features?.resendCooldownSeconds === 'number') {
      cooldownSeconds.value = features.resendCooldownSeconds;
    }
  } catch {
    // Use default cooldown if features endpoint is unavailable
  }
});

onUnmounted(() => {
  if (cooldownInterval) clearInterval(cooldownInterval);
});
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <template v-if="!emailSent">
      <UAuthForm
        :schema="schema"
        title="Passwort vergessen"
        icon="i-lucide-lock"
        :fields="fields"
        :disabled="loading"
        :loading="loading"
        :submit="{
          label: 'Link anfordern',
          block: true,
        }"
        @submit="onSubmit"
      >
        <template #title>
          <h1 class="text-2xl font-bold">Passwort vergessen</h1>
        </template>

        <template #description>
          <p class="text-sm text-muted">Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
        </template>

        <template #validation>
          <UAlert v-if="submitError" color="error" icon="i-lucide-alert-triangle" title="Anfrage fehlgeschlagen" :description="submitError" />
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
      <div role="status" aria-live="polite" class="flex flex-col items-center gap-6">
        <UIcon name="i-lucide-mail-check" class="size-16 text-success" />
        <div class="text-center">
          <h1 ref="successHeading" tabindex="-1" class="text-xl font-semibold outline-none">E-Mail gesendet</h1>
          <!--
            Deliberately conditional: Better Auth answers identically for an unknown
            address so the endpoint cannot be used to enumerate accounts. Claiming a
            mail was definitely sent would be untrue in that case — and it steers the
            user away from the most common real cause, a mistyped address.
          -->
          <p class="mt-2 text-sm text-muted">
            Falls ein Konto mit <span class="text-default font-medium">{{ submittedEmail }}</span> existiert, haben wir dir einen Link zum Zurücksetzen deines Passworts geschickt.
            Bitte überprüfe auch deinen Spam-Ordner.
          </p>
        </div>

        <UAlert v-if="submitError" color="error" icon="i-lucide-alert-triangle" title="Erneutes Senden fehlgeschlagen" :description="submitError" class="w-full" />

        <div class="flex w-full flex-col gap-3">
          <UButton
            block
            :color="resendCooldown > 0 ? 'neutral' : 'primary'"
            :disabled="resendCooldown > 0"
            :loading="resending"
            :variant="resendCooldown > 0 ? 'outline' : 'solid'"
            @click="resendResetLink"
          >
            {{ resendCooldown > 0 ? `Neue E-Mail senden (${resendCooldown}s)` : 'Neue E-Mail senden' }}
          </UButton>
          <UButton block variant="ghost" color="neutral" @click="useDifferentEmail">Andere E-Mail-Adresse verwenden</UButton>
          <UButton block variant="outline" color="neutral" to="/auth/login">Zurück zur Anmeldung</UButton>
        </div>
      </div>
    </template>
  </UPageCard>
</template>
