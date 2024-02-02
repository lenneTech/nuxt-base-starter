<script setup lang="ts">
import { useGlobalMutationLoading, useGlobalQueryLoading } from '@vue/apollo-composable';

const queryLoading = useGlobalQueryLoading();
const mutationLoading = useGlobalMutationLoading();
</script>

<template>
  <div>
    <NuxtLoadingIndicator :loading="queryLoading || mutationLoading" />
    <slot></slot>
  </div>
</template>
