<script setup lang="ts">
const props = defineProps({
  error: Object,
});

console.error(props.error);
const debugWord = ref<string>('');
const { current } = useMagicKeys();

watch(
  () => current.values(),
  () => {
    if (current.values().next().value === 'escape') {
      debugWord.value = '';
      return;
    }

    if (debugWord.value === 'debug') {
      return;
    }

    if (current.values().next().value && !debugWord.value.includes(current.values().next().value)) {
      debugWord.value += current.values().next().value;
    }
  },
);

const handleError = () => clearError({ redirect: '/' });
</script>

<template>
  <NuxtLayout>
    <div class="w-full min-h-screen flex flex-col justify-center items-center">
      <div class="w-full flex flex-col items-center mb-20">
        <h1 class="text-[12rem] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400">Oops!</h1>
        <h2 v-if="error?.statusCode" class="text-3xl text-gray-600">
          {{ error?.statusCode }}
        </h2>
      </div>

      <pre v-if="debugWord === 'debug'" class="w-full max-w-3xl mb-5 mx-auto bg-black/80 text-white font-mono p-2 rounded-lg overflow-x-scroll">
      {{ { error } }}
    </pre
      >

      <BaseButton color="primary" appearance="outline" @click="handleError"> Zurück zur Startseite </BaseButton>
    </div>
  </NuxtLayout>
</template>
