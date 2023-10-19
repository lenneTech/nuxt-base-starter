<script setup lang="ts">
const props = withDefaults(defineProps<{
  percent: number | `${number}`;
  duration?: number | `${number}`;
  label?: string;
  color?: 'primary' | 'red' | 'green' | 'blue';
}>(), {
  duration: 400,
  color: 'primary',
});

type RecordFromUnion<T extends string> = {
  [K in T]: string
};

type ColorTypes = 'text' | 'background' | 'background-light';

const colorClass: Record<typeof props.color, RecordFromUnion<ColorTypes>> = {
  'primary': {
    'text': 'text-primary-600',
    'background': 'bg-primary-500',
    'background-light': 'bg-gray-200',
  },
  'red': {
    'text': 'text-red-600',
    'background': 'bg-red-500',
    'background-light': 'bg-red-200',
  },
  'green': {
    'text': 'text-green-600',
    'background': 'bg-green-500',
    'background-light': 'bg-green-200',
  },
  'blue': {
    'text': 'text-blue-600',
    'background': 'bg-blue-500',
    'background-light': 'bg-blue-200',
  },
};
</script>

<template>
  <div :style="`--percent: ${props.percent}%; --duration: ${props.duration}ms;`" class="relative pt-1 w-full">
    <div v-if="props.label" class="flex mb-2 items-center justify-between">
      <div>
        <span
          :class="[colorClass[props.color].text, colorClass[props.color]['background-light']]"
          class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full"
        >
          {{ props.label }}
        </span>
      </div>
      <div class="text-right">
        <span :class="[colorClass[props.color].text]" class="text-xs font-semibold inline-block ">
          {{ (+props.percent).toFixed(0) }}%
        </span>
      </div>
    </div>
    <div :class="colorClass[props.color]['background-light']" class="overflow-hidden h-1 mb-4 text-xs flex rounded bg-[--color-light]">
      <div
        :class="colorClass[props.color].background"
        class="transform ease-in-out w-[--percent] duration-[--duration] shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center"
      ></div>
    </div>
  </div>
</template>