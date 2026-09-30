/**
 * Entitlement predicate and per-route chat gate on a real database
 * (audit P1-16, findings F-25 / F-26).
 */

// Config is frozen at load; the free-reply window must be on for the grant
// branch to run at all.
process.env.FREE_REPLY_WINDOW = 'true';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const DAY = 86400000;
const phone = () => `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

describeDb('entitlements on real rows', (t) => {
  const ids = [];
  let config; let models;
  const member = async (o = {}) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const sub = (userId, over = {}) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 109900, status: 'active',
    startDate: new Date(Date.now() - 40 * DAY), endDate: new Date(Date.now() + 30 * DAY),
    contactUnlocksAllowed: 5, contactUnlocksUsed: 1,
    razorpayPaymentId: `pay_${Math.random().toString(36).slice(2)}`, ...over,
  });
  const as = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' })}` });

  beforeAll(() => {
    config = require('../../../config/env');
    models = require('../../../models');
  });
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "ContactUnlocks" WHERE "userId" IN (:ids) OR "targetUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
      await sequelize.query('DELETE FROM "ChatGrants" WHERE "freeUserId" IN (:ids) OR "premiumUserId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });

  // ── F-25: getProfile must apply the endDate predicate ──────────────────────

  const viewProfile = async (viewer, target) => {
    const { getProfile } = require('../../../controllers/profileController');
    return call(getProfile, { user: { id: viewer.id, role: 'user' }, params: { userId: target.id } });
  };

  t('an expired-but-unswept plan grants no premium access and hides an unlocked number', async () => {
    const number = phone();
    const viewer = await member(); const target = await member({ user: { phone: number, phoneVerified: true } });
    await sub(viewer.id, { endDate: new Date(Date.now() - DAY) }); // status still 'active'
    await models.ContactUnlock.create({ userId: viewer.id, targetUserId: target.id });
    const res = await viewProfile(viewer, target);
    expect(res.statusCode).toBe(200);
    expect(res.body.hasPremiumAccess).toBe(false);
    expect(res.body.contactUnlocksRemaining).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain(number);
  });

  t('a live plan with an unlocked contact reveals the verified number', async () => {
    const number = phone();
    const viewer = await member(); const target = await member({ user: { phone: number, phoneVerified: true } });
    await sub(viewer.id);
    await models.ContactUnlock.create({ userId: viewer.id, targetUserId: target.id });
    const res = await viewProfile(viewer, target);
    expect(res.body.hasPremiumAccess).toBe(true);
    expect(res.body.contactUnlocksRemaining).toBe(4);
    expect(JSON.stringify(res.body)).toContain(number);
  });

  t('an old expired row does not shadow a newer live plan', async () => {
    const viewer = await member(); const target = await member();
    await sub(viewer.id, { endDate: new Date(Date.now() - 20 * DAY), createdAt: new Date(Date.now() - 60 * DAY) });
    await sub(viewer.id);
    const res = await viewProfile(viewer, target);
    expect(res.body.hasPremiumAccess).toBe(true);
  });

  // ── F-26: requireChatAccess must see the route's :userId ────────────────────

  const chatApp = () => {
    const { errorHandler } = require('../../../middlewares/errorHandler');
    const app = express();
    app.use(express.json());
    app.use('/chat', require('../../../routes/chatRoutes'));
    app.use(errorHandler);
    return app;
  };
  const codeOf = (res) => (res.body.error || res.body).code;

  t('a grant for one thread does not open every other thread', async () => {
    const app = chatApp();
    const free = await member(); const granter = await member(); const stranger = await member();
    await sub(granter.id);
    await sub(stranger.id);
    await models.ChatGrant.create({ premiumUserId: granter.id, freeUserId: free.id, messagesUsed: 0 });

    const other = await request(app).get(`/chat/messages/${stranger.id}`).set(as(free));
    expect(other.status).toBe(403);
    expect(codeOf(other)).toBe('PREMIUM_REQUIRED');

    // The thread the grant belongs to passes THIS gate (the controller then
    // applies its own mutual-match rule, which is a different error).
    const own = await request(app).get(`/chat/messages/${granter.id}`).set(as(free));
    expect(codeOf(own)).not.toBe('PREMIUM_REQUIRED');
  });

  t('listing conversations still works for a member who holds any grant', async () => {
    const app = chatApp();
    const free = await member(); const granter = await member();
    await sub(granter.id);
    await models.ChatGrant.create({ premiumUserId: granter.id, freeUserId: free.id, messagesUsed: 0 });
    const res = await request(app).get('/chat/conversations').set(as(free));
    expect(res.status).toBe(200);
  });

  t('a free member with no grant is refused at the gate on every chat route', async () => {
    const app = chatApp();
    const free = await member(); const other = await member();
    const h = as(free);
    const checks = [
      request(app).get('/chat/conversations').set(h),
      request(app).get(`/chat/messages/${other.id}`).set(h),
      request(app).post('/chat/messages').set(h).send({ receiverId: other.id, content: 'hello there' }),
      request(app).post('/chat/send').set(h).send({ receiverId: other.id, content: 'hello there' }),
    ];
    for (const r of await Promise.all(checks)) {
      expect(r.status).toBe(403);
      expect(codeOf(r)).toBe('PREMIUM_REQUIRED');
    }
  });
});
