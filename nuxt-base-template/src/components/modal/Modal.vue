<script setup lang="ts">
import { twMerge } from 'tailwind-merge';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    show: boolean;
    showInner: boolean;
    backgroundColor?: string;
    size?: 'auto' | 'sm' | 'md' | 'lg';
  }>(),
  {
    backgroundColor: '#FFF',
    size: 'auto',
  }
);

const emit = defineEmits<{
  (event: 'cancel'): void;
}>();

const attributes = useAttrs() as { class: string };
const sizeClasses: Record<typeof props.size, string> = {
  auto: 'w-4/5 md:w-auto',
  sm: 'w-4/5 md:w-1/4',
  md: 'w-4/5 md:w-3/6',
  lg: 'w-4/5 md:w-4/5',
};
const defaultClasses = 'duration-200 w-full overflow-hidden rounded-[20px] p-4 bg-[--bg-color] bg-background flex flex-col gap-4';
const classes = twMerge(defaultClasses, sizeClasses[props.size], attributes?.class);
</script>

<template>
  <div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true" :style="`--bg-color: ${props.backgroundColor};`">
    <TransitionFade>
      <div v-show="show" class="fixed inset-0 bg-background/30 backdrop-blur-sm transition-opacity flex justify-center items-center" @click="emit('cancel')">
        <TransitionFade class="w-full flex justify-center">
          <div v-show="showInner" :class="classes" @click.stop>
            <slot></slot>
          </div>
        </TransitionFade>
      </div>
    </TransitionFade>
  </div>
</template>
