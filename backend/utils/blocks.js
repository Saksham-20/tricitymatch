/**
 * Block enforcement — one implementation for every contact channel.
 *
 * `Block` used to be honoured only by new likes, search and profile view, so a
 * member who blocked someone they were already matched with was still reachable
 * through chat, voice notes, calls, family groups and sockets. Every channel
 * that lets one member reach another must go through these helpers so a block
 * is a barrier in BOTH directions and cannot be forgotten on the next channel
 * someone adds.
 *
 * The rejection message is deliberately identical whichever side placed the
 * block: telling the blocked person who blocked whom is itself a safety leak.
 */

const { Op } = require('sequelize');
const { Block } = require('../models');
const { createError } = require('../middlewares/errorHandler');

const BLOCKED_CODE = 'CONTACT_BLOCKED';
const BLOCKED_MESSAGE = 'You cannot contact this member.';

/** True when either member has blocked the other. */
const isBlockedBetween = async (userIdA, userIdB) => {
  if (!userIdA || !userIdB) return false;
  const row = await Block.findOne({
    where: {
      [Op.or]: [
        { blockerId: userIdA, blockedUserId: userIdB },
        { blockerId: userIdB, blockedUserId: userIdA },
      ],
    },
    attributes: ['id'],
  });
  return !!row;
};

/** Throws a 403 when either member has blocked the other. */
const assertNotBlocked = async (userIdA, userIdB) => {
  if (await isBlockedBetween(userIdA, userIdB)) {
    throw createError.forbidden(BLOCKED_MESSAGE, BLOCKED_CODE);
  }
};

/**
 * Ids of every member in a block relationship with `userId`, either direction.
 * For filtering lists (conversations, mutuals, likes, shortlist, viewers).
 */
const blockedIdsFor = async (userId) => {
  const rows = await Block.findAll({
    where: { [Op.or]: [{ blockerId: userId }, { blockedUserId: userId }] },
    attributes: ['blockerId', 'blockedUserId'],
  });
  const ids = new Set();
  for (const r of rows) {
    ids.add(r.blockerId === userId ? r.blockedUserId : r.blockerId);
  }
  return ids;
};

module.exports = {
  BLOCKED_CODE,
  BLOCKED_MESSAGE,
  isBlockedBetween,
  assertNotBlocked,
  blockedIdsFor,
};
