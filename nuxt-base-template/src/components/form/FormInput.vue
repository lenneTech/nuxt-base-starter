<script setup lang="ts">
import { ErrorMessage, useField } from 'vee-validate';

const props = defineProps<{
  disabled?: boolean;
  label?: string;
  name: string;
  placeholder?: string;
  type: string;
}>();

const { handleBlur, handleChange, value, meta, setTouched } = useField(() => props.name);
</script>

<template>
  <div class="mt-3">
    <label v-if="label" :for="name" class="block text-sm font-medium leading-6 text-foreground">{{ label }}{{ meta.required ? '*' : '' }}</label>
    <div class="relative mt-2 pb-2">
      <input
        :id="name"
        :type="type"
        :name="name"
        v-model="value"
        :disabled="disabled"
        @blur="handleBlur"
        @focus="setTouched(true)"
        @change="handleChange"
        class="bg-background block w-full rounded-md border-0 py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/50 focus:ring-1 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6"
        :placeholder="placeholder"
      />
      <ErrorMessage class="absolute -bottom-2.5 text-xs font-light text-red-600" :name="name" />
    </div>
  </div>
</template>
