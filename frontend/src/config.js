/** API base including `/v1` prefix (matches backend mounts). */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/v1';

/** Socket.io server (no `/v1` path). */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
