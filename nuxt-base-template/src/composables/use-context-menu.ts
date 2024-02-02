const contextMenuState = <T>() => useState<any | null>(() => null);

export function useContextMenu<T = object>() {
  const menu = contextMenuState<T>();

  const open = (config: { items: any[] }) => {
    menu.value = Object.assign(config, { show: true });
  };

  const close = () => {
    menu.value = null;
  };

  return {
    activeMenu: menu,
    close,
    open,
  };
}
