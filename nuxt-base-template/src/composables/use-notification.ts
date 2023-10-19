import { randomUUID } from 'uncrypto';

interface Notification {
  title: string;
  text?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
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
    notifications.value = notifications.value.filter(n => n.uuid !== uuid);
  };

  return {
    notify,
    remove,
    notifications,
  };
}