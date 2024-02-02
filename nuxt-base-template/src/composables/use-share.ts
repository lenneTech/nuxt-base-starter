import { useModal } from '~/composables/use-modal';
import ModalShare from '~/components/ModalShare.vue';

export function useShare() {
  const route = useRoute();

  function share(title?: string, text?: string, url?: string) {
    if (window?.navigator?.share) {
      window.navigator.share({
        url: url ?? route.fullPath,
        title: title,
        text: text ?? window.location.origin,
      });
    } else {
      useModal().open({ component: ModalShare, size: 'md', data: { link: url ?? window.location.origin, name: window.name } });
    }
  }

  return {
    share,
  };
}
