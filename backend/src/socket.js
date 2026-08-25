/**
 * Socket registry — gives non-request code (services, jobs) access to the
 * live Socket.io server so it can push real-time events to connected clients.
 *
 * Rooms used across the app:
 *   user:<userId>          → a single logged-in user (notifications)
 *   role:<role>            → every user of a role (broadcasts)
 *   hospital:<hospitalId>  → legacy entity rooms (kept for back-compat)
 *   consultant:<id>
 */

let ioRef = null;

const setIO = (io) => {
  ioRef = io;
};

const getIO = () => ioRef;

/** Emit an event to a single user's personal room. */
const emitToUser = (userId, event, payload) => {
  if (!ioRef || !userId) return;
  ioRef.to(`user:${userId.toString()}`).emit(event, payload);
};

/** Emit an event to every user of a given role. */
const emitToRole = (role, event, payload) => {
  if (!ioRef || !role) return;
  ioRef.to(`role:${role}`).emit(event, payload);
};

module.exports = { setIO, getIO, emitToUser, emitToRole };
