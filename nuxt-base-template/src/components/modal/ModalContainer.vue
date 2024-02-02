<script setup lang="ts">
const { activeModal } = useModal();
</script>

<template>
  <component :is="activeModal.component" v-if="activeModal" :context="activeModal" />
</template>
