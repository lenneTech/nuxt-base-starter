export function useShare() {
  const route = useRoute();

  async function share(title?: string, text?: string, url?: string) {
    if (!process.client) {
      return;
    }

    if (window?.navigator?.share) {
      try {
        await window.navigator.share({
          text: text ?? window.location.origin,
          title: title,
          url: url ?? route.fullPath,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(url ?? window.location.origin);
        const toast = useToast();
        toast.add({
          color: 'success',
          description: 'Der Link wurde in die Zwischenablage kopiert.',
          title: 'Link kopiert',
        });
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  }

  return {
    share,
  };
}
