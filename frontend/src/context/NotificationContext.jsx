import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../features/auth/AuthContext';
import { useSocket } from './SocketContext';
import api from '../utils/api';

const NotificationContext = createContext(null);

export const useNotifications = () => useContext(NotificationContext);

/**
 * Holds the user's in-app notifications and unread counter. Hydrates from the
 * API on login and stays live by listening to the `notification` socket event.
 */
export const NotificationProvider = ({ children }) => {
  const { token, user } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/notifications', { params: { limit: 30 } });
      if (res.data?.success) {
        setNotifications(res.data.data.items || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch {
      /* silent — bell simply stays empty */
    }
  }, [token]);

  // Initial load (and reset on logout).
  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    refresh();
  }, [token, user, refresh]);

  // Live push: prepend new notifications and bump the counter.
  useEffect(() => {
    if (!socket) return undefined;
    const onNotification = (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      toast(n.title || 'New notification', { icon: '🔔' });
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, [socket]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await api.patch(`/notifications/${id}/read`);
      if (res.data?.success) setUnreadCount(res.data.data.unreadCount ?? 0);
    } catch {
      /* optimistic update already applied */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch('/notifications/read-all');
    } catch {
      /* optimistic update already applied */
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
