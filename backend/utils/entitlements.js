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
const { Subscription, Match, ChatGrant } = require('../models');
const { PAID_PLANS } = require('../constants/plans');
const { FREE_REPLY_MAX_MESSAGES, FREE_REPLY_WINDOW_MS } = require('../constants/chat');
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
/**
 * D1 — pure state derivation for a ChatGrant row. Exported because
 * chatController re-derives it INSIDE the send transaction after taking a row
 * lock (the copy attached to `req.chatAccess` at route time may be stale by
 * the time the send executes).
 *
 * Window semantics: SEND requires `active` — fewer than FREE_REPLY_MAX_MESSAGES
 * used AND (no reply yet, or still inside FREE_REPLY_WINDOW_MS of the FIRST
 * reply). Read access never expires (the grant row existing is enough).
 */
const grantWindowState = (grant) => {
  const messagesUsed = grant.messagesUsed || 0;
  const messagesRemaining = Math.max(0, FREE_REPLY_MAX_MESSAGES - messagesUsed);
  const firstReplyAt = grant.firstReplyAt || null;
  const expiresAt = firstReplyAt
    ? new Date(new Date(firstReplyAt).getTime() + FREE_REPLY_WINDOW_MS)
    : null;
  const active = messagesRemaining > 0 && (!expiresAt || Date.now() < expiresAt.getTime());
  return { messagesUsed, messagesRemaining, firstReplyAt, expiresAt, active };
};

/**
 * D1 grant branch. ES2: a grant authorizes its FREE side only — this looks up
 * grants where `userId` is the freeUserId. The premium side never derives
 * access from a grant (a lapsed-premium member must not keep chatting through
 * grants they created); it re-derives from its live subscription above.
 *
 * Returns an access object, or null when no grant applies (fail closed on DB
 * error, same posture as getActiveSubscription).
 */
const getFreeReplyAccess = async (userId, otherUserId) => {
  try {
    if (!otherUserId) {
      // Conversations list: any held grant lets the member LIST their threads.
      const held = await ChatGrant.count({ where: { freeUserId: userId } });
      return held > 0
        ? { allowed: true, reason: 'free_reply_window', subscription: null, replyWindow: null }
        : null;
    }
    const grant = await ChatGrant.findOne({
      where: { freeUserId: userId, premiumUserId: otherUserId },
    });
    if (!grant) return null;
    // Grant = READ forever. Whether the member may still SEND is in
    // replyWindow.active; the send path re-checks under a row lock.
    return {
      allowed: true,
      reason: 'free_reply_window',
      subscription: null,
      replyWindow: grantWindowState(grant),
    };
  } catch (error) {
    log.error('Free-reply grant lookup failed', { userId, otherUserId, error: error.message });
    return null;
  }
};

const hasChatAccess = async (userId, otherUserId = null) => {
  const subscription = await getActiveSubscription(userId);
  if (subscription) return { allowed: true, reason: 'paid', subscription };

  if (config.features.freeChatForMutuals) {
    if (!otherUserId) {
      return { allowed: true, reason: 'free_chat_flag', subscription: null };
    }
    const mutual = await isMutualMatch(userId, otherUserId);
    if (mutual) {
      return { allowed: true, reason: 'free_chat_mutual', subscription: null };
    }
    // Not mutual under the free-chat flag: fall through to the grant branch
    // for shape consistency, though grants only exist for mutual pairs (a
    // premium sender must be a mutual match to have messaged at all).
  }

  if (config.features.freeReplyWindow) {
    const grantAccess = await getFreeReplyAccess(userId, otherUserId);
    if (grantAccess) return grantAccess;
  }

  if (config.features.freeChatForMutuals && otherUserId) {
    return { allowed: false, reason: 'not_mutual', subscription: null };
  }
  return { allowed: false, reason: 'premium_required', subscription: null };
};

module.exports = {
  getActiveSubscription,
  hasPaidPlan,
  isMutualMatch,
  hasChatAccess,
  grantWindowState,
};
