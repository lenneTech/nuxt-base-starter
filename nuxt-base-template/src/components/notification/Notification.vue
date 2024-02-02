<script setup lang="ts">
const props = defineProps<{
  title: string;
  text?: string;
  duration: number;
  type: 'success' | 'error' | 'warning' | 'info';
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const process = ref(100);
let durationLeft = props.duration - (500 + 130);
onMounted(() => {
  const interval = setInterval(() => {
    durationLeft -= 30;
    process.value = (durationLeft / props.duration) * 100;
  }, 30);
  setTimeout(() => {
    clearInterval(interval);
    emit('close');
  }, props.duration);
});

const icon: Record<typeof props.type, string> = {
  success: 'i-bi-check-circle',
  error: 'i-bi-exclamation-circle',
  warning: 'i-bi-exclamation-triangle',
  info: 'i-bi-info-circle',
};

const accentColor: Record<typeof props.type, string> = {
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',
  info: '#3B82F6',
};
</script>

<template>
  <div
    :style="`--accent-color: ${accentColor[props.type]}`"
    class="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg bg-white dark:bg-gray-950 shadow-lg ring-1 ring-black ring-opacity-5 z-[99999px]"
  >
    <div
      :style="{
        width: `${process}%`
      }"
      class="bg-[--accent-color] h-[5px] duration-100 transition-[width] w-[width] absolute bottom-0"
    ></div>
    <div class="p-4">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <span :class="icon[props.type]" class="h-6 w-6 text-[--accent-color]"></span>
        </div>
        <div class="ml-3 w-0 flex-1 pt-0.5">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ props.title }}
          </p>
          <p v-if="props.text" class="mt-1 text-sm text-gray-500 dark:text-white">
            {{ props.text }}
          </p>
        </div>
        <div class="ml-4 flex flex-shrink-0">
          <button
            type="button"
            class="inline-flex rounded-md bg-white text-gray-400 dark:bg-gray-100 dark:text-white hover:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            @click="emit('close')"
          >
            <span class="sr-only">Close</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
