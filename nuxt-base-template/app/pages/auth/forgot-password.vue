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
];

const schema = v.object({
  email: v.pipe(
    v.string('Email is required'),
    v.email('Has to be a valid email address'),
  ),
});

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  console.debug('Forgot password request for:', payload.data.email);
}
</script>

<template>
    <UPageCard class="w-md" variant="naked">
      <UAuthForm
        :schema="schema"
        title="Forgot password"
        icon="i-heroicons-lock-closed"
        :fields="fields"
        loadingAuto
        :submit="{
          label: 'Continue',
          block: true,
        }"
        @submit="onSubmit"
      >
        <template #footer>
          Back to
          <ULink to="/auth/login" class="text-primary font-medium" tabindex="-1">Sign In</ULink>
        </template>
      </UAuthForm>
    </UPageCard>
</template>
