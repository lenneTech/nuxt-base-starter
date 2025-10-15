<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

// ============================================================================
// Composables
// ============================================================================
const route = useRoute('auth-reset-password-token');
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
  const paramToken: string | string[] = route.params.token;
  return Array.isArray(paramToken) ? paramToken[0] : paramToken || '';
});

const isTokenValid = computed<boolean>(() => token.value.length > 0);

const isSubmitting = ref<boolean>(false);

const fields: AuthFormField[] = [
  {
    label: 'Password',
    name: 'password',
    placeholder: 'Enter your new password',
    required: true,
    type: 'password',
  },
  {
    label: 'Password Confirmation',
    name: 'passwordConfirmation',
    placeholder: 'Confirm your new password',
    required: true,
    type: 'password',
  },
];

const schema = z
  .object({
    password: z.string('Password is required').min(5, 'Must be at least 8 characters'),
    passwordConfirmation: z
      .string('Password confirmation is required')
      .min(5, 'Must be at least 8 characters'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords must match',
    path: ['passwordConfirmation'],
  });

type Schema = z.output<typeof schema>;

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(() => {
  if (!isTokenValid.value) {
    toast.add({
      color: 'error',
      description: 'The password reset link is invalid or missing',
      title: 'Invalid Link',
    });
  }
});

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  console.debug('Forgot password request for:', payload);
}
</script>

<template>
    <UPageCard class="w-md" variant="naked">
      <UAlert
        v-if="!isTokenValid"
        color="error"
        description="The password reset link is invalid or missing. Please request a new password reset."
        icon="i-heroicons-exclamation-triangle"
        title="Invalid Reset Link"
        class="mb-4"
      />
      <UAuthForm
        :schema="schema"
        title="Set password"
        icon="i-heroicons-shield-check"
        :fields="fields"
        :loading="isSubmitting"
        :submit="{
          label: 'Continue',
          block: true,
          disabled: !isTokenValid,
        }"
        @submit="onSubmit"
      />
    </UPageCard>
</template>
