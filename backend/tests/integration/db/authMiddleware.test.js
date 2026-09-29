/**
 * The authentication and entitlement gates, exercised with real signed tokens
 * and real rows (audit P1-13). This is the layer every route trusts, so it is
 * tested end to end rather than with a stubbed User.
 */

const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const DAY = 86400000;

describeDb('auth and entitlement gates', (t) => {
  const ids = [];
  let app;
  let config;

  const sign = (userId, extra = {}, opts = { expiresIn: '5m' }) =>
    jwt.sign({ userId, type: 'access', ...extra }, config.auth.jwtSecret, opts);
  const member = async (user = {}) => {
    const m = await makeMember({ user });
    ids.push(m.user.id);
    return m.user;
  };
  const sub = (userId, over = {}) => require('../../../models').Subscription.create({
    userId, planType: 'premium_plus', amount: 109900, status: 'active',
    startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 30 * DAY),
    contactUnlocksAllowed: 3, contactUnlocksUsed: 0, razorpayPaymentId: `pay_${Math.random().toString(36).slice(2)}`,
    ...over,
  });

  beforeAll(() => {
    config = require('../../../config/env');
    const mw = require('../../../middlewares/auth');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    app = express();
    app.use(cookieParser());
    const ok = (req, res) => res.json({ ok: true, id: req.user && req.user.id });
    app.get('/p', mw.auth, ok);
    app.get('/api/v1/auth/me', mw.auth, ok);
    app.get('/admin', mw.auth, mw.adminAuth, mw.requireAdminScope('users'), ok);
    app.get('/marketing', mw.auth, mw.marketingAuth, ok);
    app.get('/premium', mw.auth, mw.requirePremium, ok);
    app.get('/vip', mw.auth, mw.requireVIP, ok);
    app.get('/unlock', mw.auth, mw.requirePremium, mw.checkContactUnlockLimit, ok);
    app.use(errorHandler);
  });
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Subscriptions" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const body = (res) => res.body.error || res.body;

  t('no token, a malformed token, and a token signed with another key are all 401', async () => {
    expect((await request(app).get('/p')).status).toBe(401);
    expect((await request(app).get('/p').set('Authorization', 'Bearer not.a.jwt')).status).toBe(401);
    const u = await member();
    const forged = jwt.sign({ userId: u.id, type: 'access' }, 'some-other-secret-value-32-chars-long!!');
    expect((await request(app).get('/p').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  t('an expired token says so; a refresh-type token is not an access token', async () => {
    const u = await member();
    const expired = jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: -10 });
    const r1 = await request(app).get('/p').set('Authorization', `Bearer ${expired}`);
    expect(r1.status).toBe(401);
    expect(JSON.stringify(r1.body)).toMatch(/expired/i);
    const wrongType = jwt.sign({ userId: u.id, type: 'refresh' }, config.auth.jwtSecret, { expiresIn: '5m' });
    expect((await request(app).get('/p').set('Authorization', `Bearer ${wrongType}`)).status).toBe(401);
  });

  t('a valid token works from the header and the cookie, but never from the query string', async () => {
    const u = await member();
    const token = sign(u.id);
    expect((await request(app).get('/p').set('Authorization', `Bearer ${token}`)).body.id).toBe(u.id);
    expect((await request(app).get('/p').set('Cookie', `accessToken=${token}`)).body.id).toBe(u.id);
    expect((await request(app).get(`/p?token=${token}&accessToken=${token}`)).status).toBe(401);
  });

  t('a token for a deleted, banned or inactive account is refused', async () => {
    const banned = await member({ status: 'banned' });
    const inactive = await member({ status: 'inactive' });
    expect((await request(app).get('/p').set('Authorization', `Bearer ${sign(banned.id)}`)).status).toBe(403);
    expect((await request(app).get('/p').set('Authorization', `Bearer ${sign(inactive.id)}`)).status).toBe(403);
    const ghost = sign('00000000-0000-4000-8000-00000000dead');
    expect((await request(app).get('/p').set('Authorization', `Bearer ${ghost}`)).status).toBe(401);
  });

  t('a member on old Terms is stopped everywhere except the routes needed to accept, export or leave', async () => {
    const u = await member({ termsVersion: '1999-01-01' });
    const h = { Authorization: `Bearer ${sign(u.id)}` };
    const blocked = await request(app).get('/p').set(h);
    expect(blocked.status).toBe(403);
    expect(body(blocked).code).toBe('TERMS_RECONSENT_REQUIRED');
    expect((await request(app).get('/api/v1/auth/me').set(h)).status).toBe(200);
    // A member who has no recorded version (legacy row) is not forced.
    const legacy = await member({ termsVersion: null });
    expect((await request(app).get('/p').set('Authorization', `Bearer ${sign(legacy.id)}`)).status).toBe(200);
  });

  t('admin door and scopes: member 403, scoped sub-admin only for its scopes, admin passes', async () => {
    const plain = await member({ role: 'user' });
    const noScope = await member({ role: 'sub_admin', adminPermissions: ['support'] });
    const scoped = await member({ role: 'sub_admin', adminPermissions: ['users'] });
    const admin = await member({ role: 'admin' });
    const get = (u) => request(app).get('/admin').set('Authorization', `Bearer ${sign(u.id)}`);
    expect((await get(plain)).status).toBe(403);
    const denied = await get(noScope);
    expect(denied.status).toBe(403);
    expect(body(denied).code).toBe('ADMIN_SCOPE_REQUIRED');
    expect((await get(scoped)).status).toBe(200);
    expect((await get(admin)).status).toBe(200);
  });

  t('a malformed permissions column grants nothing', async () => {
    const odd = await member({ role: 'sub_admin', adminPermissions: { users: true } });
    const res = await request(app).get('/admin').set('Authorization', `Bearer ${sign(odd.id)}`);
    expect(res.status).toBe(403);
  });

  t('marketing routes reject ordinary members and accept marketing staff', async () => {
    const plain = await member();
    const rep = await member({ role: 'marketing' });
    expect((await request(app).get('/marketing').set('Authorization', `Bearer ${sign(plain.id)}`)).status).toBe(403);
    expect((await request(app).get('/marketing').set('Authorization', `Bearer ${sign(rep.id)}`)).status).toBe(200);
  });

  t('premium routes: an active paid plan passes; none, expired, cancelled or free do not', async () => {
    const paid = await member(); await sub(paid.id);
    const none = await member();
    const expired = await member(); await sub(expired.id, { endDate: new Date(Date.now() - DAY) });
    const cancelled = await member(); await sub(cancelled.id, { status: 'cancelled' });
    const free = await member(); await sub(free.id, { planType: 'free', amount: 0, razorpayPaymentId: null });
    const status = async (u) => (await request(app).get('/premium').set('Authorization', `Bearer ${sign(u.id)}`)).status;
    expect(await status(paid)).toBe(200);
    expect(await status(none)).toBe(403);
    expect(await status(expired)).toBe(403);
    expect(await status(cancelled)).toBe(403);
    expect(await status(free)).toBe(403);
  });

  t('the VIP gate needs an unlimited tier, not merely a paid one', async () => {
    const paid = await member(); await sub(paid.id);
    const vip = await member(); await sub(vip.id, { planType: 'vip', contactUnlocksAllowed: null });
    const get = (u) => request(app).get('/vip').set('Authorization', `Bearer ${sign(u.id)}`);
    expect((await get(paid)).status).toBe(403);
    expect((await get(vip)).status).toBe(200);
  });

  t('contact unlocks stop at the plan allowance', async () => {
    const some = await member(); await sub(some.id, { contactUnlocksAllowed: 3, contactUnlocksUsed: 2 });
    const spent = await member(); await sub(spent.id, { contactUnlocksAllowed: 3, contactUnlocksUsed: 3 });
    const get = (u) => request(app).get('/unlock').set('Authorization', `Bearer ${sign(u.id)}`);
    expect((await get(some)).status).toBe(200);
    const res = await get(spent);
    expect(res.status).toBe(403);
    expect(body(res).code).toBe('CONTACT_UNLOCK_LIMIT_REACHED');
  });
});
