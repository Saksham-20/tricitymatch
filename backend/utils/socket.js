/**
 * Socket.io singleton — allows other modules to emit events
 * without circular dependency issues.
 *
 * Usage:
 *   // In server.js (after creating io):
 *   require('./utils/socket').setIO(io);
 *
 *   // In any other module:
 *   const { getIO } = require('./utils/socket');
 *   getIO()?.to(`user_${userId}`).emit('notification', payload);
 */

let _io = null;

const setIO = (io) => { _io = io; };
const getIO = () => _io;

module.exports = { setIO, getIO };
