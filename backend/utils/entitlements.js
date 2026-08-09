'use strict';

/**
 * Entitlement reads (Phase 2, D8.4).
 *
 * Why this file exists: before it, "is this user paid?" had TWO parallel
 * implementations — `requirePremium` (middlewares/auth.js) and the socket's
 * local `checkSubscription` (socket/socketHandler.js) — sharing only the
 * PAID_PLANS constant. Chat is gated in both places, so a chat-specific rule
 * added to one of them silently disagrees with the other.
 *
 * CHAT IS THE ONLY CALLER OF hasChatAccess. `requirePremium` is deliberately
 * NOT rewritten to use this module: it also gates calls, likes-you, profile
 * viewers, contact unlock, the kundli PDF and invoices, so branching the
 * free-chat flag there would hand all of those away too.
 *
 * FREE_CHAT_FOR_MUTUALS ships DARK (default false = today's behaviour, chat is
 * premium-only). Flipping it on is a deliberate config change and a two-way
 * door — nothing is written to the database either way, so flipping back
 * restores the gate exactly.
 */

const { Op } = require('sequelize');
const { Subscription, Match } = require('../models');
const { PAID_PLANS } = require('../constants/plans');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

/**
 * The user's live paid subscription, or null.
 *
 * The endDate predicate is part of the QUERY, not a follow-up check: the hourly
 * Bull sweep that flips expired rows to `status:'expired'` is cleanup, not
 * correctness. If Redis is down the sweep never runs, and a row that says
 * "active" with a past endDate must still read as unentitled.
 */
const getActiveSubscription = async (userId) => {
  if (!userId) return null;
  try {
    return await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        planType: { [Op.in]: PAID_PLANS },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
      },
      order: [['createdAt', 'DESC']],
    });
  } catch (error) {
    // Fail CLOSED: a DB blip must not read as "entitled".
    log.error('Entitlement lookup failed', { userId, error: error.message });
    return null;
  }
};

const hasPaidPlan = async (userId) => Boolean(await getActiveSubscription(userId));

/** Mutual match in either direction. */
const isMutualMatch = async (userId, otherUserId) => {
  if (!userId || !otherUserId || userId === otherUserId) return false;
  try {
    const match = await Match.findOne({
      where: {
        [Op.or]: [
          { userId, matchedUserId: otherUserId, isMutual: true },
          { userId: otherUserId, matchedUserId: userId, isMutual: true },
        ],
      },
      attributes: ['id'],
    });
    return Boolean(match);
  } catch (error) {
    log.error('Mutual match check failed', { userId, otherUserId, error: error.message });
    return false;
  }
};

/**
 * May `userId` use chat — and, when `otherUserId` is given, chat with THAT
 * person?
 *
 * Paid members are unconditionally allowed (the per-thread mutual-match rule
 * still lives in the chat controller and the socket, which is where it has
 * always been). Free members are allowed only when the flag is on AND the pair
 * is a mutual match.
 *
 * `otherUserId` is optional because `GET /chat/conversations` has no other
 * user: with the flag on, every authenticated member may LIST their threads —
 * the list is built from mutual matches already, so it cannot leak a
 * conversation the member has no claim to.
 *
 * @returns {Promise<{allowed: boolean, reason: 'paid'|'free_chat_mutual'|'free_chat_flag'|'not_mutual'|'premium_required', subscription: object|null}>}
 */
const hasChatAccess = async (userId, otherUserId = null) => {
  const subscription = await getActiveSubscription(userId);
  if (subscription) return { allowed: true, reason: 'paid', subscription };

  if (!config.features.freeChatForMutuals) {
    return { allowed: false, reason: 'premium_required', subscription: null };
  }

  if (!otherUserId) {
    return { allowed: true, reason: 'free_chat_flag', subscription: null };
  }

  const mutual = await isMutualMatch(userId, otherUserId);
  return mutual
    ? { allowed: true, reason: 'free_chat_mutual', subscription: null }
    : { allowed: false, reason: 'not_mutual', subscription: null };
};

module.exports = {
  getActiveSubscription,
  hasPaidPlan,
  isMutualMatch,
  hasChatAccess,
};
