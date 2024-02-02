<script setup lang="ts">
import { ErrorMessage, useField } from 'vee-validate';

interface Option {
  label: string;
  value: any;
}

const props = defineProps<{
  disabled?: boolean;
  label?: string;
  multiple?: boolean;
  name: string;
  options: Option[];
  placeholder?: string;
}>();

const { handleBlur, handleChange, meta, value, setTouched } = useField(() => props.name);
</script>

<template>
  <div class="relative mt-3 pb-2">
    <label v-if="label" :for="name" class="block text-sm font-medium leading-6 text-foreground">{{ label }}{{ meta.required ? '*' : '' }}</label>
    <select
      :id="name"
      v-model="value"
      @focus="setTouched(true)"
      :name="name"
      :multiple="multiple ?? false"
      :disabled="disabled"
      class="bg-background mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-foreground ring-1 ring-inset ring-border focus:ring-1 focus:ring-primary-500 sm:text-sm sm:leading-6"
      @blur="handleBlur"
      @change="handleChange"
    >
      <option class="text-foreground/50" :value="null" disabled selected>{{ placeholder }}</option>
      <option v-for="option of options" :value="option.value">{{ option.label }}</option>
    </select>
    <ErrorMessage class="absolute -bottom-2.5 text-xs font-light text-red-600" :name="name" />
  </div>
</template>
