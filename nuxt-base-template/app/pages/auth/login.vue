<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

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

const schema = v.object({
  email: v.pipe(v.string('Email is required'), v.email('Has to be a valid email address')),
  password: v.pipe(v.string('Password is required'), v.minLength(5, 'Must be at least 5 characters')),
});

type Schema = InferOutput<typeof schema>;

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
        <ULink to="/auth/forgot-password" class="text-primary font-medium" tabindex="-1">Forgot your password? </ULink>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
