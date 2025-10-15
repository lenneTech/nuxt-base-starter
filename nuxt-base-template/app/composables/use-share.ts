export function useShare() {
  const route = useRoute();

  async function share(title?: string, text?: string, url?: string) {
    if (!process.client) return;

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
        const { notify } = useNotification();
        notify({
          title: 'Link kopiert',
          text: 'Der Link wurde in die Zwischenablage kopiert.',
          type: 'success',
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
