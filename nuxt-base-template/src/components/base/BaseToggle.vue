<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    active?: boolean;
  }>(),
  {
    active: false,
  }
);
const toggleActive = ref(false);

watch(
  () => props.active,
  () => {
    toggleActive.value = props.active;
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex justify-between items-center cursor-pointer" @click="toggleActive = !toggleActive">
    <div class="w-8 h-5 flex items-center bg-gray-300 rounded-full p-1 duration-300 ease-in-out" :class="{ 'bg-green-400': toggleActive }">
      <div class="bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out" :class="{ 'translate-x-2': toggleActive }"></div>
    </div>
  </div>
</template>
