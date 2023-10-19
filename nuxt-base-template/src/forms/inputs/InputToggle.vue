<script setup lang="ts">
const props = defineProps({
  context: Object,
});
const inputValue = ref(props?.context?._value ?? false);

watch(() => inputValue.value, () => {
  props.context?.node.input(inputValue.value);
});
</script>

<template>
  <div class="flex justify-between items-center" @click="inputValue = !inputValue">
    <div class="w-8 h-5 flex items-center bg-gray-300 rounded-full p-1 duration-300 ease-in-out" :class="{ 'bg-green-400': inputValue }">
      <div class="bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out" :class="{ 'translate-x-2': inputValue }"></div>
    </div>
  </div>
</template>
