<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    startDuration?: number | `${number}`;
    leaveDuration?: number | `${number}`;
  }>(),
  {
    startDuration: 100,
    leaveDuration: 100,
  }
);
</script>

<template>
  <div :style="`--start-duration: ${props.startDuration}ms; --leave-duration: ${props.leaveDuration}ms;`">
    <Transition
      enter-active-class="transition ease-out duration-[--start-duration]"
      enter-from-class="transform opacity-0"
      enter-to-class="transform opacity-100"
      leave-active-class="transition ease-in duration-[--leave-duration]"
      leave-from-class="transform opacity-100"
      leave-to-class="transform opacity-0"
    >
      <slot></slot>
    </Transition>
  </div>
</template>
