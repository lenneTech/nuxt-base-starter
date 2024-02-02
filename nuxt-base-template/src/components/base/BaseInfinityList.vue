<script setup lang="ts">
const emit = defineEmits<{
  (event: 'loadMore'): void;
}>();
const scrollContainer = ref<HTMLElement | null>(null);
let infinityScrollInProgress = false;

const handleScroll = async () => {
  let element = scrollContainer.value;
  if (!infinityScrollInProgress && element && element.getBoundingClientRect().bottom < window.innerHeight) {
    infinityScrollInProgress = true;

    emit('loadMore');

    setTimeout(() => {
      infinityScrollInProgress = false;
    }, 1000);
  }
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div ref="scrollContainer">
    <slot></slot>
  </div>
</template>
