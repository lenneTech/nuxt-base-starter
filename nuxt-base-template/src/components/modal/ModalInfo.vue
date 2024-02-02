<script setup lang="ts">
import type { ModalContext } from '~/composables/use-modal';

const props = defineProps<{ context: ModalContext<{ text: string; title: string }> }>();
const { close } = useModal();
</script>

<template>
  <Modal class="p-10 relative" :show="context.show" :show-inner="context.showInner" :size="context.size" @cancel="context.closable ? close() : null">
    <div class="flex items-center justify-center mb-2">
      <div class="font-semibold text-xl text-foreground">
        {{ context?.data?.title }}
      </div>
      <button class="absolute top-5 right-5" @click="close()">
        <span class="i-bi-x text-2xl hover:text-primary-500 duration-200"></span>
      </button>
    </div>
    <div class="text-center text-foreground mb-6">
      {{ context?.data?.text }}
    </div>
  </Modal>
</template>
