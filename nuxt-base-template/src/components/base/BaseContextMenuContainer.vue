<script setup lang="ts">
import { useMouse } from '@vueuse/core';

import { useContextMenu } from '~/composables/use-context-menu';

const { activeMenu, close } = useContextMenu();
const target = ref();
const isLeft = usePageLeave();

onClickOutside(target, () => close());

const { x, y } = useMouse();
const left = ref(0);
const top = ref(0);

watch(
  () => isLeft.value,
  () => {
    close();
  }
);

watch(
  () => activeMenu.value,
  () => {
    if (activeMenu.value?.show) {
      left.value = unref(x.value);
      top.value = unref(y.value);
    }
  }
);
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <TransitionFade leave-duration="150" start-duration="150">
        <div
          v-show="activeMenu"
          @mouseleave="close()"
          ref="target"
          class="absolute w-56 right-0 origin-top-right border border-border bg-background overflow-hidden shadow-lg rounded-md focus:outline-none"
          :style="`top: ${top}px; left: ${left}px`"
        >
          <button
            v-for="item of activeMenu?.items"
            :key="item"
            type="button"
            class="w-full text-left text-foreground px-4 py-2 text-sm hover:bg-hover hover:text-foreground flex justify-between items-center"
            @click="
              item.click();
              close();
            "
          >
            {{ item.label }}
          </button>
        </div>
      </TransitionFade>
    </Teleport>
  </ClientOnly>
</template>
