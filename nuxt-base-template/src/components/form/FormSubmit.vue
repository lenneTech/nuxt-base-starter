<script setup lang="ts">
const props = defineProps<{
  isSubmitting?: boolean;
  label: string;
}>();
</script>

<template>
  <div>
    <BaseButton v-if="isSubmitting" type="button" disabled>
      <span class="animate-bounce">.</span>
      <span class="animate-bounce delay-150">.</span>
      <span class="animate-bounce delay-300 me-1">.</span>
      Loading
    </BaseButton>
    <BaseButton v-else type="submit"> {{ label }} </BaseButton>
  </div>
</template>
