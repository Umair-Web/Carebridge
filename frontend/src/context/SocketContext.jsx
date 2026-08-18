import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../features/auth/AuthContext';
import { SOCKET_URL } from '../config';

const SocketContext = createContext(null);

/** Access the single shared Socket.io connection (or null when logged out). */
export const useSocket = () => useContext(SocketContext);

/**
 * Maintains ONE socket connection for the logged-in user and joins every room
 * the app needs: the personal `user:<id>` room (notifications), the `role:<role>`
 * room, and the legacy entity rooms used by existing per-page listeners.
 */
export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      return undefined;
    }

    const s = io(SOCKET_URL, { transports: ['websocket'] });

    const joinRooms = () => {
      // Generic personal + role rooms (notifications, global refresh).
      s.emit('join', { token });
      // Legacy entity rooms kept for back-compat with existing emitters.
      if (user.role === 'hospital') s.emit('join_hospital', { token });
      if (user.role === 'consultant') s.emit('join_consultant', { token });
      if (user.role === 'laboratory') s.emit('join_laboratory', { token });
    };

    s.on('connect', joinRooms);
    setSocket(s);

    return () => {
      s.off('connect', joinRooms);
      s.disconnect();
      setSocket(null);
    };
  }, [token, user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};
