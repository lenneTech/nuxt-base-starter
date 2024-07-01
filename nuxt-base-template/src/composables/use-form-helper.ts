export function useFormHelper() {
  const { close, open } = useModal();

  function onReload(dirty: boolean, event: BeforeUnloadEvent) {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  async function onNavigate(dirty: boolean) {
    if (dirty) {
      const answer = await openConfirmModal();
      if (!answer) {
        return false;
      }
    }
    return true;
  }

  function openConfirmModal() {
    return new Promise((resolve) => {
      open({
        component: 'ModalConfirm', // TODO: Replace with correct component
        confirm: (confirmed) => {
          resolve(confirmed);
          close();
        },
        data: {
          text:
            'Sind  Sie sich sicher, dass Sie den Vorgang abbrechen möchten?\n' +
            'Es befinden sich ungesicherte Daten auf dieser Seite.',
          title: 'Vorsicht, ungesicherte Daten!',
        },
      });
    });
  }

  return {
    onNavigate,
    onReload,
  };
}
