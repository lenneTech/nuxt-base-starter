<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    expanded?: boolean;
  }>(),
  {
    expanded: false,
  }
);

const show = ref(false);
const contents = ref<HTMLElement>();

watch(
  () => props.expanded,
  () => {
    show.value = props.expanded;
  },
  { immediate: true }
);

const { height: targetHeight } = useElementSize(contents, undefined, {
  box: 'border-box',
});

const height = computed(() => (show.value ? targetHeight.value : 0));
</script>

<template>
  <div class="group border-b border-gray-800 bg-white dark:bg-gray-950 dark:border-gray-500 transition duration-500 hover:bg-gray-50">
    <div class="flex cursor-pointer items-center justify-center p-5 md:p-6">
      <div class="text-base text-gray-900 transition group-hover:text-gray-950 md:text-lg">
        <slot name="title"></slot>
      </div>

      <div class="relative ml-auto flex items-center justify-center">
        <span :class="{ 'rotate-180': show, 'rotate-45': !show }" class="i-bi-x h-5 w-5 text-gray-900 transition-transform duration-500 md:h-6 md:w-6 dark:bg-white"></span>
      </div>
    </div>

    <div
      :style="{
        height: `${height}px`,
      }"
      class="overflow-hidden px-5 transition-[height] duration-500 will-change-[height] md:px-6"
    >
      <div ref="contents" class="space-y-4 pb-5 font-light leading-relaxed tracking-wide text-gray-900 md:pb-6">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
