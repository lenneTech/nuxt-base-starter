<template>
  <Transition
    enter-active-class="transition ease-out duration-500"
    enter-from-class="transform translate-x-[-100%]"
    enter-to-class="transform translate-x-0"
    leave-active-class="transition ease-in duration-500"
    leave-from-class="transform translate-x-0"
    leave-to-class="transform translate-x-[-100%]"
  >
    <slot />
  </Transition>
</template>
