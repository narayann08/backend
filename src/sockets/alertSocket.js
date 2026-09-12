'use strict';
const { Server } = require('socket.io');
const logger = require('../utils/logger');

/** @type {import('socket.io').Server|null} */
let io = null;

/**
 * Initialise Socket.IO on the HTTP server.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', socket => {
    logger.debug(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
  });

  logger.info('Socket.IO initialised');
}

/**
 * Emit a new_alert event to all connected dashboard clients.
 * Called by notificationTool when a risk window is detected.
 * @param {object} alert
 */
function emitAlert(alert) {
  if (!io) {
    logger.warn('Socket.IO not initialised — cannot emit alert');
    return;
  }
  io.emit('new_alert', alert);
}

module.exports = { initSocket, emitAlert };
