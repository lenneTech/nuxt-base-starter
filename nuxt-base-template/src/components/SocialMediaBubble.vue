<script setup lang="ts">
const props = defineProps<{
  icon: string;
  title: string;
  bgColor: string;
}>();
</script>

<template>
  <button class="flex flex-col items-center group">
    <span class="rounded-full w-14 h-14 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1" :style="{ 'background-color': bgColor }">
      <span class="text-2xl text-white" :class="icon"></span>
    </span>
    <small class="text-sm font-light mt-2">{{ title }}</small>
  </button>
</template>
