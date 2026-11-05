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
const { httpInitEnabled, httpInitTokenRequired, initSetup, needsSetup } = useSystemSetup();
const { translateError } = useLtErrorTranslation();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'Ersteinrichtung',
});

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);

/**
 * What the page shows, from `GET /system-setup/status` (nest-server 12.4.0+, nuxt-extensions 1.25.0+).
 *
 * The form only while the API takes the first admin over HTTP: outside `local`, `ci` and `e2e`,
 * nest-server closes `POST /system-setup/init` unless `systemSetup.httpInit` opens it, and the form
 * would then fail with 403 on every submit. `null` means the status is not read yet. After a 403,
 * `initSetup` re-reads the status, so a submit refused with LTNS_0053 lands on the hint by itself.
 */
const view = computed<'checking' | 'closed' | 'done' | 'form'>(() => {
  if (needsSetup.value === false) {
    return 'done';
  }
  if (needsSetup.value === true && httpInitEnabled.value === true) {
    return 'form';
  }
  if (needsSetup.value === true && httpInitEnabled.value === false) {
    return 'closed';
  }
  return 'checking';
});

const baseFields: AuthFormField[] = [
  {
    autocomplete: 'name',
    label: 'Name',
    name: 'name',
    placeholder: 'Name eingeben',
    required: true,
    type: 'text',
  },
  {
    // `username`, not `email`: it pairs this field with the password for the password manager.
    // `type: 'email'` keeps validation and the keyboard (DEV-3147).
    autocomplete: 'username',
    label: 'E-Mail',
    name: 'email',
    placeholder: 'E-Mail eingeben',
    required: true,
    type: 'email',
  },
  {
    autocomplete: 'new-password',
    label: 'Passwort',
    name: 'password',
    placeholder: 'Passwort eingeben',
    required: true,
    type: 'password',
  },
  {
    autocomplete: 'new-password',
    label: 'Passwort bestätigen',
    name: 'confirmPassword',
    placeholder: 'Passwort wiederholen',
    required: true,
    type: 'password',
  },
];

// The token is the value of NSC__SYSTEM_SETUP__HTTP_INIT__TOKEN. Only the API can tell a wrong one
// (LTNS_0054), so there is no length rule here, and `off` keeps saved passwords out of the field.
const tokenField: AuthFormField = {
  autocomplete: 'off',
  help: 'Der Wert aus NSC__SYSTEM_SETUP__HTTP_INIT__TOKEN der API.',
  label: 'Setup-Token',
  name: 'token',
  placeholder: 'Setup-Token eingeben',
  required: true,
  type: 'password',
};

const fields = computed<AuthFormField[]>(() => (httpInitTokenRequired.value === true ? [...baseFields, tokenField] : baseFields));

const schema = v.pipe(
  v.object({
    confirmPassword: v.pipe(v.string('Passwortbestätigung ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
    email: v.pipe(v.string('E-Mail ist erforderlich'), v.email('Bitte eine gültige E-Mail eingeben')),
    name: v.pipe(v.string('Name ist erforderlich'), v.minLength(2, 'Mindestens 2 Zeichen erforderlich')),
    password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
    token: v.optional(v.string()),
  }),
  v.forward(
    v.partialCheck([['password'], ['confirmPassword']], (input) => input.password === input.confirmPassword, 'Passwörter stimmen nicht überein'),
    ['confirmPassword'],
  ),
  v.forward(
    v.partialCheck([['token']], (input) => httpInitTokenRequired.value !== true || !!input.token?.trim(), 'Setup-Token ist erforderlich'),
    ['token'],
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
      token: httpInitTokenRequired.value === true ? payload.data.token : undefined,
    });

    toast.add({
      color: 'success',
      description: 'Das System wurde erfolgreich eingerichtet.',
      title: 'Administrator-Account erstellt',
    });

    await navigateTo('/auth/login');
  } catch (err: unknown) {
    // The error itself, not `err.message`: on a FetchError that is the transport line
    // (`[POST] "…": 403 Forbidden`), and the #LTNS_ code is in the response body.
    toast.add({
      color: 'error',
      description: err ? translateError(err) : 'Einrichtung fehlgeschlagen',
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
      v-if="view === 'form'"
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
      <template #title>
        <h1 class="text-2xl font-bold">System einrichten</h1>
      </template>

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

    <div v-else-if="view === 'closed'" class="space-y-4">
      <div class="flex flex-col items-center gap-2 text-center">
        <UIcon name="i-lucide-shield-check" class="size-8 text-primary" />
        <h1 class="text-2xl font-bold">System einrichten</h1>
      </div>

      <UAlert color="info" variant="subtle" title="Die Ersteinrichtung erfolgt über die Konfiguration">
        <template #description>
          <!-- wrap-anywhere: the names have no break point and are wider than a phone. Without it the
               centred card grew past the left edge of the screen, where nothing scrolls, and the start
               of each name was cut off (tests/e2e/system-setup.spec.ts checks 320 px). -->
          <div class="space-y-3 text-sm">
            <p>Auf diesem System lässt sich der erste Administrator nicht über diese Seite anlegen. Setze dafür diese Umgebungsvariablen der API und starte die API neu:</p>
            <ul class="list-disc space-y-1 pl-5">
              <li><code class="wrap-anywhere">NSC__SYSTEM_SETUP__INITIAL_ADMIN__EMAIL</code></li>
              <li><code class="wrap-anywhere">NSC__SYSTEM_SETUP__INITIAL_ADMIN__PASSWORD</code></li>
              <li><code class="wrap-anywhere">NSC__SYSTEM_SETUP__INITIAL_ADMIN__NAME</code> (optional)</li>
            </ul>
            <p>
              Oder gib diese Seite mit einem Setup-Token frei: Setze <code class="wrap-anywhere">NSC__SYSTEM_SETUP__HTTP_INIT__TOKEN</code> (mindestens 16 Zeichen, nicht nur
              Ziffern), starte die API neu und lade diese Seite neu. Das Formular fragt dann nach dem Token.
            </p>
          </div>
        </template>
      </UAlert>

      <p class="text-center text-sm text-muted">
        <ULink to="/auth/login" class="text-primary font-medium">Zur Anmeldung</ULink>
      </p>
    </div>

    <div v-else-if="view === 'done'" class="space-y-2 text-center">
      <h1 class="text-2xl font-bold">System einrichten</h1>
      <p class="text-sm text-muted">Das System ist bereits eingerichtet.</p>
      <ULink to="/auth/login" class="text-primary font-medium">Zur Anmeldung</ULink>
    </div>

    <p v-else class="text-center text-sm text-muted" role="status">Einrichtungsstatus wird geprüft …</p>
  </UPageCard>
</template>
