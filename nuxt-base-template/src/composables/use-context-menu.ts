const contextMenuState = () => useState<any | null>(() => null);

export function useContextMenu() {
  const menu = contextMenuState();

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
