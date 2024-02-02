<script setup lang="ts">
import { ErrorMessage, useField } from 'vee-validate';

enum InputType {
  Password = 'password',
  Text = 'text',
}

const props = defineProps<{
  label: string;
  name: string;
  placeholder: string;
}>();

const type = ref<InputType>(InputType.Password);
const { handleBlur, handleChange, meta, value, setTouched } = useField(() => props.name);

function changeType() {
  type.value = type.value === InputType.Password ? InputType.Text : InputType.Password;
}
</script>

<template>
  <div class="mt-3">
    <label v-if="label" :for="name" class="block text-sm font-medium leading-6 text-foreground">{{ label }}{{ meta.required ? '*' : '' }}</label>
    <div class="relative mt-2 pb-2">
      <div class="relative">
        <input
          :id="name"
          v-model="value"
          :type="type"
          :name="name"
          @blur="handleBlur"
          @focus="setTouched(true)"
          @change="handleChange"
          class="bg-background block w-full rounded-md border-0 py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/50 focus:ring-1 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6"
          :placeholder="placeholder"
        />
        <button type="button" class="absolute right-2 bottom-1/2 transform translate-y-1/2 text-secondary-100 flex items-center hover:text-primary-500" @click="changeType()">
          <span v-if="type === 'password'" class="i-bi-eye"></span>
          <span v-else class="i-bi-eye-slash"></span>
        </button>
      </div>
      <ErrorMessage class="absolute -bottom-2.5 text-xs font-light text-red-600" :name="name" />
    </div>
  </div>
</template>
