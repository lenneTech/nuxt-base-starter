<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    leaveDuration?: `${number}` | number;
    startDuration?: `${number}` | number;
  }>(),
  {
    leaveDuration: 100,
    startDuration: 100,
  },
);
</script>

<template>
  <div :style="`--start-duration: ${props.startDuration}ms; --leave-duration: ${props.leaveDuration}ms;`">
    <Transition
      enter-active-class="transition ease-out duration-[--start-duration]"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-[--leave-duration]"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <slot ></slot>
    </Transition>
  </div>
</template>
