import ModalShare from '~/components/ModalShare.vue';
import { useModal } from '~/composables/use-modal';

export function useShare() {
  const route = useRoute();

  function share(title?: string, text?: string, url?: string) {
    if (window?.navigator?.share) {
      window.navigator.share({
        text: text ?? window.location.origin,
        title: title,
        url: url ?? route.fullPath,
      });
    } else {
      useModal().open({ component: ModalShare, data: { link: url ?? window.location.origin, name: window.name }, size: 'md' });
    }
  }

  return {
    share,
  };
}
