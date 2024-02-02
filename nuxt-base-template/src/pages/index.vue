<script setup lang="ts">
import FormTextarea from '~/components/form/FormTextarea.vue';

const isSubmitting = ref(false);
</script>

<template>
  <div class="flex h-screen items-center justify-center flex-col">
    <h1 class="font-extrabold text-transparent text-8xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Lenne Nuxt Starter</h1>

    <h2 class="mt-5">DEMO</h2>
    <FormInput name="email" type="email" label="E-Mail" placeholder="max.mustermann@test.de" />
    <FormTextarea name="description" label="Description" placeholder="..." />
    <FormPassword name="password" label="Password" placeholder="Password" />
    <FormSelect
      name="select"
      label="Select"
      placeholder="placeholder"
      :options="[
        { label: 'Option 1', value: 1 },
        { label: 'Option 2', value: 2 },
        { label: 'Option 3', value: 3 },
      ]"
    />
    <FormToggle name="toggle" label="Toggle" />
    <div class="flex items-center gap-3">
      <FormSubmit label="Save" :is-submitting="isSubmitting" @click="isSubmitting = true" />
      <BaseButton size="sm" :loading="isSubmitting" @click="isSubmitting = true">Submit</BaseButton>
      <BaseButton size="lg" :loading="isSubmitting" @click="isSubmitting = true">Submit</BaseButton>
      <BaseButton size="md" :loading="isSubmitting" appearance="outline" @click="isSubmitting = true">Submit</BaseButton>
      <BaseButton size="md" :loading="isSubmitting" appearance="none" @click="isSubmitting = true">Submit</BaseButton>
      <BaseButton size="md" color="danger" @click="isSubmitting = false">Reset</BaseButton>
    </div>
  </div>
</template>
