<script setup lang="ts"></script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-500"
    enter-from-class="transform translate-y-full"
    enter-to-class="transform translate-y-0"
    leave-active-class="transition ease-in duration-500"
    leave-from-class="transform translate-y-0"
    leave-to-class="transform translate-y-full"
  >
    <slot></slot>
  </Transition>
</template>
