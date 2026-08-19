/**
 * ES6 exit-gate verification — D1 concurrent-send race on REAL Postgres.
 *
 * The sqlite unit suite cannot exercise `FOR UPDATE`, so this script runs the
 * exact lock-check-increment pattern sendMessage uses, twice in parallel, at
 * messagesUsed = MAX-1. Exactly ONE send may succeed.
 *
 * Run (backend/): NODE_ENV=development node scripts-verify/verify-free-reply-race.js
 * Uses two seeded users; cleans up its grant + messages afterwards.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const sequelize = require('../config/database');
const { User, ChatGrant, Message } = require('../models');
const { grantWindowState } = require('../utils/entitlements');
const { FREE_REPLY_MAX_MESSAGES } = require('../constants/chat');

const attemptSend = async (freeUserId, premiumUserId) => {
  try {
    return await sequelize.transaction(async (t) => {
      const grant = await ChatGrant.findOne({
        where: { freeUserId, premiumUserId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!grant) throw new Error('grant missing');
      const state = grantWindowState(grant);
      if (!state.active) return { ok: false, reason: 'REPLY_WINDOW_ENDED' };
      if (!grant.firstReplyAt) grant.firstReplyAt = new Date();
      await Message.create(
        { senderId: freeUserId, receiverId: premiumUserId, content: 'race-probe' },
        { transaction: t }
      );
      grant.messagesUsed += 1;
      await grant.save({ transaction: t });
      return { ok: true, used: grant.messagesUsed };
    });
  } catch (e) {
    return { ok: false, reason: e.message };
  }
};

(async () => {
  const users = await User.findAll({ attributes: ['id'], limit: 2, order: [['createdAt', 'ASC']] });
  if (users.length < 2) {
    console.error('Need 2 seeded users');
    process.exit(1);
  }
  const [freeUser, premiumUser] = users.map((u) => u.id);

  await ChatGrant.destroy({ where: { freeUserId: freeUser, premiumUserId: premiumUser } });
  await ChatGrant.create({
    freeUserId: freeUser,
    premiumUserId: premiumUser,
    messagesUsed: FREE_REPLY_MAX_MESSAGES - 1,
    firstReplyAt: new Date(),
  });

  const [a, b] = await Promise.all([
    attemptSend(freeUser, premiumUser),
    attemptSend(freeUser, premiumUser),
  ]);

  const successes = [a, b].filter((r) => r.ok).length;
  const grant = await ChatGrant.findOne({ where: { freeUserId: freeUser, premiumUserId: premiumUser } });

  console.log('attempt A:', JSON.stringify(a));
  console.log('attempt B:', JSON.stringify(b));
  console.log('final messagesUsed:', grant.messagesUsed);

  // Cleanup
  await Message.destroy({ where: { senderId: freeUser, receiverId: premiumUser, content: 'race-probe' } });
  await ChatGrant.destroy({ where: { freeUserId: freeUser, premiumUserId: premiumUser } });

  if (successes === 1 && grant.messagesUsed === FREE_REPLY_MAX_MESSAGES) {
    console.log('PASS: exactly one concurrent send succeeded; counter capped at', FREE_REPLY_MAX_MESSAGES);
    process.exit(0);
  }
  console.error(`FAIL: ${successes} sends succeeded (expected 1)`);
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
