'use strict';

/**
 * Graceful shutdown (SITE-12).
 *
 * The old sequence called server.close() and only closed Socket.io inside its
 * callback. That callback never fires while upgraded websocket connections stay
 * open, so every deploy waited out a 30s forced-exit timer, accepted no new
 * connections meanwhile, and Docker's default 10s stop timeout SIGKILLed the
 * process before the clean path (queues, cache, database) ever ran.
 *
 * Order here: close Socket.io first (it also closes the HTTP server and drops
 * the websockets), then stop the HTTP server for anything left, release idle
 * keep-alive sockets, then close queues, cache and the database. The forced-exit
 * timer is shorter than the container's stop_grace_period (docker-compose.yml).
 */

const DEFAULT_FORCE_EXIT_MS = 12000;

const createShutdown = ({
  server, io, closeQueues, closeCache, sequelize,
  exit = (code) => process.exit(code),
  logger = console,
  forceExitMs = DEFAULT_FORCE_EXIT_MS,
}) => {
  let started = false;

  const closeServer = () => new Promise((resolve) => {
    if (!server || !server.listening) return resolve();
    server.close(() => resolve());
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  });

  const closeSockets = () => new Promise((resolve) => {
    if (!io) return resolve();
    try { io.close(() => resolve()); } catch (err) { logger.error('Error closing sockets:', err); resolve(); }
  });

  return async (signal, { exitCode = 0 } = {}) => {
    if (started) return; // a second signal or a crash during shutdown must not restart it
    started = true;
    logger.log(`\n${signal} received: starting graceful shutdown`);

    const timer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      exit(1);
    }, forceExitMs);
    if (typeof timer.unref === 'function') timer.unref();

    await closeSockets();
    logger.log('✓ Socket.io connections closed');
    await closeServer();
    logger.log('✓ HTTP server closed');

    const step = async (label, fn) => {
      try { await fn(); logger.log(`✓ ${label} closed`); } catch (err) { logger.error(`✗ Error closing ${label}:`, err); }
    };
    await step('Job queues', closeQueues);
    await step('Cache connections', closeCache);
    await step('Database connection', () => sequelize.close());

    clearTimeout(timer);
    logger.log('Graceful shutdown completed');
    exit(exitCode);
  };
};

module.exports = { createShutdown, DEFAULT_FORCE_EXIT_MS };
