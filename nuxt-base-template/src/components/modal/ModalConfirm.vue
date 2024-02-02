<script setup lang="ts">
import type { ModalContext } from '~/composables/use-modal';

const props = defineProps<{
  context: ModalContext<{
    cancelText: string;
    confirmColor?: 'primary' | 'secondary' | 'green' | 'yellow' | 'lightprimary' | 'danger';
    confirmText: string;
    text: string;
    title: string;
  }>;
}>();
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
    <div class="mb-5 text-foreground">
      {{ context?.data?.text }}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
      <BaseButton appearance="outline" color="primary" @click="context?.confirm?.(false)">
        {{ context?.data?.cancelText || 'Abbrechen' }}
      </BaseButton>
      <BaseButton :color="context?.data?.confirmColor || 'primary'" @click="context?.confirm?.(true)">
        {{ context?.data?.confirmText || 'Ok' }}
      </BaseButton>
    </div>
  </Modal>
</template>
