<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});


// ============================================================================
// Variables
// ============================================================================
const fields: AuthFormField[] = [
  {
    label: 'Email',
    name: 'email',
    placeholder: 'Enter your email',
    required: true,
    type: 'email',
  },
  {
    label: 'Password',
    name: 'password',
    placeholder: 'Enter your password',
    required: true,
    type: 'password',
  },
];

const schema = z.object({
  email: z.email('Email is required'),
  password: z.string('Password is required').min(5, 'Must be at least 8 characters'),
});

type Schema = z.output<typeof schema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  console.debug('Login request for:', payload.data.email);
}
</script>

<template>
    <UPageCard class="w-md" variant="naked">
      <UAuthForm
        :schema="schema"
        title="Login"
        icon="i-lucide-user"
        :fields="fields"
        loadingAuto
        :submit="{
          label: 'Log In',
          block: true,
        }"
        @submit="onSubmit"
      >
        <template #password-hint>
          <ULink to="/auth/forgot-password" class="text-primary font-medium" tabindex="-1"
            >Forgot your password?
          </ULink>
        </template>
      </UAuthForm>
    </UPageCard>
</template>
