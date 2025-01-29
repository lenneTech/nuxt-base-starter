import { randomUUID } from 'uncrypto';

interface Notification {
  duration?: number;
  text?: string;
  title: string;
  type: 'error' | 'info' | 'success' | 'warning';
}

const notificationState = () => useState<Array<Notification & { uuid: string }>>(() => []);

export function useNotification() {
  const notifications = notificationState();
  const notify = (message: Notification) => {
    const data = Object.assign(message, { uuid: randomUUID() });
    data.duration ??= 5000;
    notifications.value.push(data);
  };

  const remove = (uuid: string) => {
    notifications.value = notifications.value.filter((n) => n.uuid !== uuid);
  };

  return {
    notifications,
    notify,
    remove,
  };
}
