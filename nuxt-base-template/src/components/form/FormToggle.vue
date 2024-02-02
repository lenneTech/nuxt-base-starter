<script setup lang="ts">
import { ErrorMessage, useField } from 'vee-validate';

const props = defineProps<{
  disabled?: boolean;
  label?: string;
  name: string;
}>();

const { handleChange, meta, value, setTouched } = useField(() => props.name);

watch(
  () => value.value,
  () => {
    handleChange(value.value);
    setTouched(true);
  }
);
</script>

<template>
  <div class="relative mt-3 pb-2">
    <label v-if="label" :for="name" class="block text-sm font-medium leading-6 text-foreground">{{ label }}{{ meta.required ? '*' : '' }}</label>
    <BaseToggle v-model:active="value" :disabled="disabled" />
    <ErrorMessage class="absolute -bottom-2.5 text-xs font-light text-red-600" :name="name" />
  </div>
</template>
