<script setup lang="ts">
import type { ModalContext } from '~/composables/use-modal';
import SocialMediaBubble from '~/components/SocialMediaBubble.vue';

const props = defineProps<{ context: ModalContext<{ link: string; name: string }> }>();
const { close } = useModal();
const url = ref<string>('');

onMounted(() => {
  url.value = props.context.data?.link ? props.context.data?.link : window.location.href;
});

const copyUrl = () => {
  useClipboard({ source: url.value }).copy();
  useNotification().notify({ type: 'success', title: 'Erfolgreich', text: 'Link wurde erfolgreich kopiert!' });
};

const shareWith = (type: 'mail' | 'whatsapp' | 'facebook' | 'linkedin' | 'twitter') => {
  switch (type) {
    case 'mail':
      open(`mailto:?subject=${props.context.data?.name}&body=${encodeURIComponent(url.value)}`, '_blank');
      break;
    case 'whatsapp':
      open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(url.value)}`, '_blank');
      break;
    case 'facebook':
      open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url.value)}`, '_blank');
      break;
    case 'linkedin':
      open(`https://www.linkedin.com/shareArticle?url=${encodeURIComponent(url.value)}`, '_blank');
      break;
    case 'twitter':
      open(`https://twitter.com/share?url=${encodeURIComponent(url.value)}`, '_blank');
      break;
  }
};
</script>

<template>
  <Modal class="p-10 relative" :show="context.show" :show-inner="context.showInner" :size="context.size" @cancel="context.closable ? close() : null">
    <div class="flex items-center justify-center mb-4">
      <div class="font-semibold text-xl text-foreground">Teilen</div>
      <button class="absolute top-5 right-5" @click="close()">
        <span class="i-bi-x text-2xl hover:text-primary-500"></span>
      </button>
    </div>
    <div class="text-center text-foreground">
      <div class="flex justify-around max-w-md mx-auto gap-3 py-2 mb-5 overflow-x-scroll">
        <SocialMediaBubble title="E-Mail" bg-color="#bbbbbb" icon="i-bi-envelope" @click="shareWith('mail')" />
        <SocialMediaBubble title="Whatsapp" bg-color="#25d366" icon="i-bi-whatsapp" @click="shareWith('whatsapp')" />
        <SocialMediaBubble title="Facebook" bg-color="#3b5998" icon="i-bi-facebook" @click="shareWith('facebook')" />
        <SocialMediaBubble title="LinkedIn" bg-color="#0a66c2" icon="i-bi-linkedin" @click="shareWith('linkedin')" />
        <SocialMediaBubble title="X / Twitter" bg-color="#000000" icon="i-bi-twitter-x" @click="shareWith('twitter')" />
      </div>
      <div class="flex items-center gap-3 justify-between p-3 border border-border rounded-lg">
        <span class="text-ellipsis overflow-hidden">
          {{ url }}
        </span>
        <BaseButton size="sm" @click="copyUrl()"> Kopieren </BaseButton>
      </div>
    </div>
  </Modal>
</template>
