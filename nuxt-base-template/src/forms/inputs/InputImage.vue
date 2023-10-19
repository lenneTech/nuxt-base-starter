<script setup lang="ts">
const props = defineProps({
  context: Object,
});

const value = ref('');
const label = props.context?.label;
const text = props.context?.attrs.text;
const name = props.context?.name;
const config = useRuntimeConfig();
await getPreviewUrl(props.context?._value);

watch(() => props.context?._value, async () => {
  await getPreviewUrl(props.context?._value);
});

function handleInput(e: any) {
  if (!e) {
    props.context?.node.input(null);
    return;
  }

  props.context?.node.input(e.target.files[0]);
}

async function getPreviewUrl(src: string | File) {
  if (!src) {
    value.value = '';
  }

  const validHexChars = /^[0-9a-fA-F]{24}$/;
  if (typeof src === 'object' && validHexChars.test(src?.id)) {
    // return config.public.apiUrl + '/files/' + src.id;
    const response = await useAuthFetch(config.public.apiUrl + '/files/' + src?.id, { method: 'GET' });
    value.value = URL.createObjectURL(response as any);
  }
  else if (typeof src === 'string') {
    value.value = src;
  } else if (src instanceof File) {
    value.value = URL.createObjectURL(src);
  }
}
</script>

<template>
  <div class="image-container" :class="props?.context?.classes.container">
    <div v-if="!props.context?._value" :class="props?.context?.classes.uploader">
      <label :class="context?.classes.placeholder">{{ text }}</label>
      <input
        :id="props.context?.id"
        :name="name"
        type="file"
        :class="props?.context?.classes.input"
        @input="handleInput"
      />
    </div>
    <div v-else :class="props?.context.classes.fileItem">
      <img :src="value" :class="props?.context?.classes.fileItemImage" />
      <span :class="props?.context.classes.fileItemImageName">{{ props.context?._value?.name ?? props.context?._value?.filename }}</span>
      <button type="button" :class="props?.context.classes.fileItemRemove" @click="handleInput(null)">
        Entfernen
      </button>
    </div>
  </div>
</template>