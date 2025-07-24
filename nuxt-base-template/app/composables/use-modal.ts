export interface ModalContext<T = object> {
  closable?: boolean;
  component: any;
  confirm?: (confirmed: boolean) => void;
  data?: T;
  show: boolean;
  showInner: boolean;
  size?: 'auto' | 'lg' | 'md' | 'sm';
}

interface Modal<T> {
  closable?: boolean;
  component: any;
  confirm?: (confirmed: boolean) => void;
  data?: T;
  size?: 'auto' | 'lg' | 'md' | 'sm';
}

const modalState = <T>() => useState<ModalContext<T> | null>(() => null);

export function useModal<T = object>() {
  const modal = modalState<T>();

  const open = (modalConfig: Modal<T>) => {
    let delay = 0;
    if (modal.value) {
      delay = 130;
    }

    const data = Object.assign(modalConfig, { show: false, showInner: false }) as ModalContext<T>;
    data.size ??= 'md';
    data.closable ??= true;

    setTimeout(() => {
      modal.value = data;
    }, delay);

    // Disable scrolling of background
    document.body.style.overflowY = 'hidden';

    setTimeout(() => {
      if (modal.value) {
        modal.value.show = true;
      }
    }, 30 + delay);

    setTimeout(() => {
      if (modal.value) {
        modal.value.showInner = true;
      }
    }, 100 + delay);
  };

  const close = (duration?: number) => {
    let animationDuration = duration;

    if (typeof animationDuration !== 'number') {
      animationDuration = 100;
    }

    if (modal.value) {
      modal.value.showInner = false;

      setTimeout(() => {
        if (modal.value) {
          modal.value.show = false;
        }
      }, 30 + animationDuration);
    }

    // Deactivate scrolling of background
    document.body.style.overflowY = '';

    setTimeout(() => {
      modal.value = null;
    }, 130 + animationDuration);
  };

  return {
    activeModal: modal,
    close,
    open,
  };
}
