/**
 * Unread counts — the one definition of each badge number, shared by the REST
 * endpoints (`GET /notifications/unread-count`, `GET /chat/unread-count`) and
 * the realtime push, so the two can never disagree.
 *
 * Why the push exists: every open web tab used to poll both endpoints every
 * 30 s although it already holds a Socket.io connection joined to
 * `user_<id>`. ~1,000 open tabs = ~67 req/s of polling on a 1-vCPU box. Now the
 * server pushes the new number when it changes and the web app polls only as a
 * slow safety net. Shipped mobile builds keep polling the REST endpoints, which
 * are unchanged.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const config = require('../config/env');
const { Message, Notification } = require('../models');
const { blockedIdsFor } = require('./blocks');
const { ACTIVE_MEMBERS_SQL } = require('./memberRole');
const { getIO } = require('./socket');
const { log } = require('../middlewares/logger');

const UNREAD_COUNTS_EVENT = 'unread:counts';

// A burst (ten notifications from one job, a run of chat messages) costs one
// count query per kind and one emit, not one per event.
const COALESCE_MS = 300;

/** Notifications the member has not read. */
const unreadNotificationCount = (userId) =>
  Notification.count({ where: { userId, isRead: false } });

/**
 * Chat messages waiting for the member. Same people the conversation list
 * shows: active members only (a staff account or a banned member's thread is
 * not listed, so it is not counted), and nobody in a block with them.
 */
const unreadMessageCount = async (userId) => {
  const blocked = [...(await blockedIdsFor(userId))];
  return Message.count({
    where: {
      receiverId: userId,
      isRead: false,
      senderId: {
        [Op.in]: sequelize.literal(ACTIVE_MEMBERS_SQL),
        ...(blocked.length ? { [Op.notIn]: blocked } : {}),
      },
    },
  });
};

const COUNTERS = {
  notifications: unreadNotificationCount,
  chat: unreadMessageCount,
};

// userId -> { kinds: Set<string>, timer }
const pending = new Map();

const roomFor = (userId) => `user_${userId}`;

// Skip the count query when nobody is listening. Only knowable for the local
// adapter: with the Redis adapter the member's tab may be on another instance.
const someoneListening = (io, userId) => {
  if (config.socket && config.socket.redisAdapter) return true;
  const rooms = io.sockets && io.sockets.adapter && io.sockets.adapter.rooms;
  if (!rooms || typeof rooms.get !== 'function') return true;
  const room = rooms.get(roomFor(userId));
  return Boolean(room && room.size);
};

const flush = async (userId) => {
  const entry = pending.get(userId);
  pending.delete(userId);
  if (!entry) return;

  const io = getIO();
  if (!io || !someoneListening(io, userId)) return;

  const payload = {};
  await Promise.all([...entry.kinds].map(async (kind) => {
    try {
      payload[kind] = await COUNTERS[kind](userId);
    } catch (err) {
      log.warn('Unread count push skipped', { kind, error: err.message });
    }
  }));
  if (!Object.keys(payload).length) return;

  try {
    io.to(roomFor(userId)).emit(UNREAD_COUNTS_EVENT, payload);
  } catch (err) {
    log.warn('Unread count emit failed', { error: err.message });
  }
};

/**
 * Fire-and-forget: send the member's current count(s) to every tab they have
 * open. Calls within COALESCE_MS for the same member are merged into one
 * computation and one `unread:counts` event carrying only the requested kinds,
 * e.g. `{ notifications: 3 }` or `{ notifications: 3, chat: 1 }`.
 *
 * Never throws and never delays the caller. A no-op without a Socket.io server
 * (tests, worker processes) and when the member has no socket connected.
 *
 * @param {string} userId
 * @param {'notifications'|'chat'|Array<'notifications'|'chat'>} kinds
 */
const pushUnreadCounts = (userId, kinds) => {
  try {
    if (!userId) return;
    const io = getIO();
    if (!io || !someoneListening(io, userId)) return;

    const wanted = (Array.isArray(kinds) ? kinds : [kinds]).filter((k) => COUNTERS[k]);
    if (!wanted.length) return;

    const entry = pending.get(userId);
    if (entry) {
      wanted.forEach((k) => entry.kinds.add(k));
      return;
    }

    const timer = setTimeout(() => {
      flush(userId).catch((err) => log.warn('Unread count push failed', { error: err.message }));
    }, COALESCE_MS);
    if (typeof timer.unref === 'function') timer.unref();
    pending.set(userId, { kinds: new Set(wanted), timer });
  } catch (err) {
    log.warn('Unread count push not scheduled', { error: err.message });
  }
};

/** Test-only: drop every scheduled push. */
const _resetUnreadPushes = () => {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
};

module.exports = {
  UNREAD_COUNTS_EVENT,
  COALESCE_MS,
  unreadNotificationCount,
  unreadMessageCount,
  pushUnreadCounts,
  _resetUnreadPushes,
};
