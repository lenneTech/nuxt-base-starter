<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import QRCode from 'qrcode';
import * as v from 'valibot';

import ModalBackupCodes from '~/components/Modal/ModalBackupCodes.vue';

// ============================================================================
// Interfaces
// ============================================================================
interface Passkey {
  createdAt: Date;
  id: string;
  name?: string;
}

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const overlay = useOverlay();
const { is2FAEnabled, registerPasskey, setUser, user } = useLtAuth();
const authClient = useLtAuthClient();

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);
const totpUri = ref<string>('');
const qrCodeSvg = ref<string>('');
const backupCodes = ref<string[]>([]);
const showTotpSetup = ref<boolean>(false);
const show2FADisable = ref<boolean>(false);
const passkeys = ref<Passkey[]>([]);
const passkeyLoading = ref<boolean>(false);
const newPasskeyName = ref<string>('');
const showAddPasskey = ref<boolean>(false);

// Form states for UForm (required for proper data binding)
const enable2FAForm = reactive({ password: '' });
const disable2FAForm = reactive({ password: '' });
const totpForm = reactive({ code: '' });

const passwordSchema = v.object({
  password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(1, 'Passwort ist erforderlich')),
});

const totpSchema = v.object({
  code: v.pipe(v.string('Code ist erforderlich'), v.length(6, 'Code muss 6 Ziffern haben')),
});

type PasswordSchema = InferOutput<typeof passwordSchema>;
type TotpSchema = InferOutput<typeof totpSchema>;

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(async () => {
  await loadPasskeys();
});

async function addPasskey(): Promise<void> {
  if (!newPasskeyName.value.trim()) {
    toast.add({
      color: 'error',
      description: 'Bitte gib einen Namen für den Passkey ein',
      title: 'Fehler',
    });
    return;
  }

  passkeyLoading.value = true;

  try {
    // Use custom registerPasskey method with direct API calls
    const result = await registerPasskey(newPasskeyName.value);

    if (!result.success) {
      toast.add({
        color: 'error',
        description: result.error || 'Passkey konnte nicht hinzugefügt werden',
        title: 'Fehler',
      });
      return;
    }

    toast.add({
      color: 'success',
      description: 'Passkey wurde erfolgreich hinzugefügt',
      title: 'Erfolg',
    });

    newPasskeyName.value = '';
    showAddPasskey.value = false;
    await loadPasskeys();
  } finally {
    passkeyLoading.value = false;
  }
}

async function deletePasskey(id: string): Promise<void> {
  passkeyLoading.value = true;

  try {
    const { error } = await authClient.passkey.deletePasskey({
      id,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Passkey konnte nicht gelöscht werden',
        title: 'Fehler',
      });
      return;
    }

    toast.add({
      color: 'success',
      description: 'Passkey wurde gelöscht',
      title: 'Erfolg',
    });

    await loadPasskeys();
  } finally {
    passkeyLoading.value = false;
  }
}

async function disable2FA(payload: FormSubmitEvent<PasswordSchema>): Promise<void> {
  loading.value = true;

  try {
    const { error } = await authClient.twoFactor.disable({
      password: payload.data.password,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || '2FA konnte nicht deaktiviert werden',
        title: 'Fehler',
      });
      return;
    }

    // Update user state to reflect 2FA disabled
    if (user.value) {
      setUser({ ...user.value, twoFactorEnabled: false });
    }

    toast.add({
      color: 'success',
      description: '2FA wurde deaktiviert',
      title: 'Erfolg',
    });

    show2FADisable.value = false;
    disable2FAForm.password = '';
  } finally {
    loading.value = false;
  }
}

async function enable2FA(payload: FormSubmitEvent<PasswordSchema>): Promise<void> {
  loading.value = true;

  try {
    const { data, error } = await authClient.twoFactor.enable({
      password: payload.data.password,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || '2FA konnte nicht aktiviert werden',
        title: 'Fehler',
      });
      return;
    }

    totpUri.value = data?.totpURI ?? '';
    backupCodes.value = data?.backupCodes ?? [];

    // Generate QR code as SVG for better password manager compatibility
    if (totpUri.value) {
      qrCodeSvg.value = await QRCode.toString(totpUri.value, {
        type: 'svg',
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
    }

    showTotpSetup.value = true;
    enable2FAForm.password = '';
  } finally {
    loading.value = false;
  }
}

// ============================================================================
// Functions
// ============================================================================
async function loadPasskeys(): Promise<void> {
  try {
    const { data, error } = await authClient.passkey.listUserPasskeys();

    if (error) {
      console.error('Failed to load passkeys:', error);
      return;
    }

    passkeys.value = (data ?? []) as Passkey[];
  } catch {
    console.error('Failed to load passkeys');
  }
}

function resetTotpSetup(): void {
  showTotpSetup.value = false;
  totpForm.code = '';
  totpUri.value = '';
  qrCodeSvg.value = '';
}

async function openBackupCodesModal(codes: string[] = []): Promise<void> {
  const modal = overlay.create(ModalBackupCodes, {
    props: {
      initialCodes: codes,
    },
  });
  await modal.open();
}

async function verifyTotp(payload: FormSubmitEvent<TotpSchema>): Promise<void> {
  loading.value = true;

  try {
    const { error } = await authClient.twoFactor.verifyTotp({
      code: payload.data.code,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Code ungültig',
        title: 'Fehler',
      });
      return;
    }

    // Update user state to reflect 2FA enabled
    if (user.value) {
      setUser({ ...user.value, twoFactorEnabled: true });
    }

    toast.add({
      color: 'success',
      description: '2FA wurde erfolgreich aktiviert',
      title: 'Erfolg',
    });

    resetTotpSetup();
    await openBackupCodesModal(backupCodes.value);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <div>
      <h1 class="text-2xl font-bold">Sicherheit</h1>
      <p class="text-muted">Verwalte deine Sicherheitseinstellungen</p>
    </div>

    <!-- 2FA Section -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-shield-check" class="size-6 text-primary" />
          <div>
            <h2 class="font-semibold">Zwei-Faktor-Authentifizierung</h2>
            <p class="text-sm text-muted">Zusätzliche Sicherheit für dein Konto</p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">Status</p>
            <p class="text-sm text-muted">
              {{ is2FAEnabled ? '2FA ist aktiviert' : '2FA ist deaktiviert' }}
            </p>
          </div>
          <UBadge :color="is2FAEnabled ? 'success' : 'neutral'">
            {{ is2FAEnabled ? 'Aktiv' : 'Inaktiv' }}
          </UBadge>
        </div>

        <template v-if="!is2FAEnabled && !showTotpSetup">
          <UForm :schema="passwordSchema" :state="enable2FAForm" class="space-y-4" @submit="enable2FA">
            <UFormField label="Passwort bestätigen" name="password">
              <UInput v-model="enable2FAForm.password" type="password" placeholder="Dein Passwort" />
            </UFormField>
            <UButton type="submit" :loading="loading"> 2FA aktivieren </UButton>
          </UForm>
        </template>

        <template v-if="showTotpSetup">
          <div class="space-y-4">
            <p class="text-sm text-muted">Scanne den QR-Code mit deiner Authenticator-App (z.B. Google Authenticator, Authy) und gib den Code ein.</p>

            <div class="flex justify-center">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-if="qrCodeSvg" class="rounded-lg bg-white p-2" v-html="qrCodeSvg" />
            </div>

            <UForm :schema="totpSchema" :state="totpForm" class="space-y-4" @submit="verifyTotp">
              <UFormField label="Verifizierungscode" name="code">
                <UInput v-model="totpForm.code" placeholder="000000" class="text-center font-mono" />
              </UFormField>
              <div class="flex gap-2">
                <UButton type="submit" :loading="loading"> Verifizieren </UButton>
                <UButton variant="outline" color="neutral" @click="resetTotpSetup"> Abbrechen </UButton>
              </div>
            </UForm>
          </div>
        </template>

        <template v-if="is2FAEnabled && !show2FADisable">
          <div class="flex gap-2">
            <UButton variant="outline" @click="show2FADisable = true"> 2FA deaktivieren </UButton>
            <UButton variant="outline" color="neutral" @click="openBackupCodesModal()"> Backup-Codes anzeigen </UButton>
          </div>
        </template>

        <template v-if="show2FADisable">
          <UForm :schema="passwordSchema" :state="disable2FAForm" class="space-y-4" @submit="disable2FA">
            <UAlert color="warning" icon="i-lucide-alert-triangle"> 2FA zu deaktivieren verringert die Sicherheit deines Kontos. </UAlert>
            <UFormField label="Passwort bestätigen" name="password">
              <UInput v-model="disable2FAForm.password" type="password" placeholder="Dein Passwort" />
            </UFormField>
            <div class="flex gap-2">
              <UButton type="submit" color="error" :loading="loading"> 2FA deaktivieren </UButton>
              <UButton variant="outline" color="neutral" @click="show2FADisable = false"> Abbrechen </UButton>
            </div>
          </UForm>
        </template>
      </div>
    </UCard>

    <!-- Passkeys Section -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-fingerprint" class="size-6 text-primary" />
          <div>
            <h2 class="font-semibold">Passkeys</h2>
            <p class="text-sm text-muted">Passwordlose Anmeldung mit biometrischen Daten</p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <template v-if="passkeys.length > 0">
          <div class="divide-y">
            <div v-for="passkey in passkeys" :key="passkey.id" class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-key" class="size-5 text-muted" />
                <div>
                  <p class="font-medium">{{ passkey.name || 'Unbenannter Passkey' }}</p>
                  <p class="text-xs text-muted">Erstellt am {{ new Date(passkey.createdAt).toLocaleDateString('de-DE') }}</p>
                </div>
              </div>
              <UButton variant="ghost" color="error" icon="i-lucide-trash-2" size="sm" :loading="passkeyLoading" @click="deletePasskey(passkey.id)" />
            </div>
          </div>
        </template>

        <template v-else>
          <p class="text-center text-muted py-4">Du hast noch keine Passkeys eingerichtet.</p>
        </template>

        <template v-if="!showAddPasskey">
          <UButton variant="outline" icon="i-lucide-plus" @click="showAddPasskey = true"> Passkey hinzufügen </UButton>
        </template>

        <template v-else>
          <div class="flex gap-2">
            <UInput v-model="newPasskeyName" placeholder="Name für den Passkey" class="flex-1" />
            <UButton :loading="passkeyLoading" @click="addPasskey"> Hinzufügen </UButton>
            <UButton
              variant="outline"
              color="neutral"
              @click="
                showAddPasskey = false;
                newPasskeyName = '';
              "
            >
              Abbrechen
            </UButton>
          </div>
        </template>
      </div>
    </UCard>

    <!-- Account Info -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-user" class="size-6 text-primary" />
          <div>
            <h2 class="font-semibold">Kontoinformationen</h2>
            <p class="text-sm text-muted">Deine Kontodaten</p>
          </div>
        </div>
      </template>

      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-muted">E-Mail</span>
          <span class="font-medium">{{ user?.email }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Name</span>
          <span class="font-medium">{{ user?.name || '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">E-Mail verifiziert</span>
          <UBadge :color="user?.emailVerified ? 'success' : 'warning'">
            {{ user?.emailVerified ? 'Ja' : 'Nein' }}
          </UBadge>
        </div>
      </div>
    </UCard>
  </div>
</template>
