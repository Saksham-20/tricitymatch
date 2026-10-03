'use strict';

/**
 * Ending a mutual relationship between two members: the mutual flag, any chat
 * grant, any live call, and the chat socket room. Shared by Block and by a
 * member withdrawing their interest, so the two cannot drift apart.
 *
 * Match rows are kept (history, analytics, admin review) — only `isMutual` is
 * cleared. A free-reply chat grant must not outlive the relationship.
 */

const { Op } = require('sequelize');
const { Match, ChatGrant, CallSession } = require('../models');
const { log } = require('../middlewares/logger');
const { getIO } = require('./socket');

/**
 * Database half. Runs inside the caller's transaction when one is given.
 * @param {string} a
 * @param {string} b
 * @param {{ transaction?: object, clearMutualDate?: boolean }} [opts]
 */
const severRelationshipRows = async (a, b, { transaction, clearMutualDate = false } = {}) => {
  const pair = [
    { userId: a, matchedUserId: b },
    { userId: b, matchedUserId: a },
  ];
  await Match.update(
    { isMutual: false, ...(clearMutualDate ? { mutualMatchDate: null } : {}) },
    { where: { [Op.or]: pair, isMutual: true }, transaction }
  );
  await ChatGrant.destroy({
    where: {
      [Op.or]: [
        { premiumUserId: a, freeUserId: b },
        { premiumUserId: b, freeUserId: a },
      ],
    },
    transaction,
  });
  await CallSession.update(
    { status: 'ended', endedAt: new Date() },
    {
      where: {
        status: { [Op.in]: ['initiated', 'accepted'] },
        [Op.or]: [
          { callerId: a, calleeId: b },
          { callerId: b, calleeId: a },
        ],
      },
      transaction,
    }
  );
};

/** Socket half. Call AFTER the transaction commits. Never throws. */
const evictChatRoom = (a, b) => {
  try {
    const io = getIO();
    if (io) {
      const room = [a, b].sort().join('_room_');
      io.in(room).socketsLeave(room);
    }
  } catch (err) {
    log.error('Chat room eviction failed', { a, b, error: err.message });
  }
};

/**
 * Group socket rooms are membership-checked once, at join time, so a member who
 * is removed (or leaves) keeps receiving the room's events until they
 * disconnect. Call AFTER the membership row is destroyed. Never throws.
 *
 * With a userId only that member's sockets leave; without one the whole room is
 * emptied (group deleted). Returns the number of sockets evicted.
 */
const evictGroupRoom = async (groupId, userId = null) => {
  try {
    const io = getIO();
    if (!io) return 0;
    const room = `group_${groupId}`;
    const sockets = await io.in(room).fetchSockets();
    let evicted = 0;
    for (const s of sockets) {
      // `rooms` exists on local sockets and on RemoteSocket (redis adapter) alike.
      if (userId && !(s.rooms && s.rooms.has(`user_${userId}`))) continue;
      s.leave(room);
      evicted += 1;
    }
    return evicted;
  } catch (err) {
    log.error('Group room eviction failed', { groupId, userId, error: err.message });
    return 0;
  }
};

module.exports = { severRelationshipRows, evictChatRoom, evictGroupRoom };
