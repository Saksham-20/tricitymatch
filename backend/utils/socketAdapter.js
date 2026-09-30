'use strict';

/**
 * Redis adapter for Socket.io (audit P2: horizontal scale).
 *
 * With one backend process, an emit reaches every connected socket because they
 * are all in that process. With two, a message emitted by instance A never
 * reaches a member connected to instance B. The Redis adapter relays emits
 * between instances through pub/sub.
 *
 * Off by default (SOCKET_REDIS_ADAPTER=false): production runs one backend
 * container today, and the adapter is a moving part with no benefit until there
 * is a second. Turn it on together with adding instances. Two more things are
 * needed at that point and are NOT done by this switch:
 *   - the load balancer must keep a client on one instance for the length of a
 *     polling handshake (sticky sessions), or use websocket-only transport;
 *   - per-process state in socket/socketHandler.js (online-presence map) has to
 *     move to Redis, or presence will show only the members on the same instance.
 *
 * Fails soft: if Redis is not reachable the server keeps the default in-process
 * adapter and says so, rather than refusing to start.
 */

const config = require('../config/env');
const { log } = require('../middlewares/logger');
const { getRedisClient } = require('./cache');

const attachRedisAdapter = (io) => {
  if (!config.socket.redisAdapter) return { attached: false, reason: 'disabled' };
  const client = getRedisClient();
  if (!client) {
    log.warn('SOCKET_REDIS_ADAPTER is on but Redis is not available; using the in-process adapter');
    return { attached: false, reason: 'no_redis' };
  }
  const { createAdapter } = require('@socket.io/redis-adapter');
  // pub/sub need connections of their own: a subscribed connection cannot issue
  // ordinary commands.
  const pub = client.duplicate();
  const sub = client.duplicate();
  for (const c of [pub, sub]) {
    c.on('error', (err) => log.error('Socket adapter Redis error', { error: err.message }));
  }
  io.adapter(createAdapter(pub, sub));
  log.info('Socket.io Redis adapter attached');
  return { attached: true, pub, sub };
};

module.exports = { attachRedisAdapter };
