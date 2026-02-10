import { useState, useCallback } from 'react';

interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Hook pour les notifications toast.
 *
 * Usage:
 *   const { notification, notify, clearNotification } = useNotification();
 *   notify('Enregistré !', 'success');
 *
 *   return notification && <Notification {...notification} onClose={clearNotification} />;
 */
export function useNotification() {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const notify = useCallback((message: string, type: NotificationState['type'] = 'info') => {
    setNotification({ message, type });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return { notification, notify, clearNotification };
}
