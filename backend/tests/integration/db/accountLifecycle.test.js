/**
 * Pause and deletion grace on a real database (audit P2, P8-05).
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const PASSWORD = 'Str0ng!Pass-2026';
const DAY = 86400000;

describeDb('pause and scheduled deletion', (t) => {
  const ids = [];
  let app; let config; let models; let lifecycle;
  const member = async () => { const m = await makeMember({ user: { password: PASSWORD } }); ids.push(m.user.id); return m.user; };
  const as = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' })}` });
  const profileOf = (u) => models.Profile.findOne({ where: { userId: u.id } });

  beforeAll(() => {
    config = require('../../../config/env');
    models = require('../../../models');
    lifecycle = require('../../../utils/accountLifecycle');
    const { sanitizeRequest, extractIp } = require('../../../middlewares/security');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    app = express();
    app.set('trust proxy', true);
    app.use(extractIp);
    app.use(cookieParser('test-cookie-secret-for-testing'));
    app.use(express.json());
    app.use(sanitizeRequest);
    app.use('/api/auth', require('../../../routes/authRoutes'));
    app.use('/api/profile', require('../../../routes/profileRoutes'));
    app.use(errorHandler);
  });
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  // ── pause ──────────────────────────────────────────────────────────────────

  t('pausing hides the profile from viewers; resuming brings it back', async () => {
    const { getProfile } = require('../../../controllers/profileController');
    const owner = await member(); const viewer = await member();
    const view = () => call(getProfile, { user: { id: viewer.id, role: 'user' }, params: { userId: owner.id } });

    expect((await view()).statusCode).toBe(200);
    const paused = await request(app).post('/api/profile/me/pause').set(as(owner));
    expect(paused.status).toBe(200);
    expect((await profileOf(owner)).isActive).toBe(false);
    expect((await profileOf(owner)).pausedAt).not.toBeNull();
    expect((await view()).statusCode).toBe(404);

    expect((await request(app).post('/api/profile/me/resume').set(as(owner))).status).toBe(200);
    expect((await profileOf(owner)).isActive).toBe(true);
    expect((await view()).statusCode).toBe(200);
  });

  t('pausing twice keeps the first timestamp', async () => {
    const u = await member();
    await request(app).post('/api/profile/me/pause').set(as(u));
    const first = (await profileOf(u)).pausedAt.getTime();
    await new Promise((r) => setTimeout(r, 20));
    await request(app).post('/api/profile/me/pause').set(as(u));
    expect((await profileOf(u)).pausedAt.getTime()).toBe(first);
  });

  t('a paused member cannot send interests while hidden', async () => {
    const { matchAction } = require('../../../controllers/matchController');
    const paused = await member(); const other = await member();
    await lifecycle.pauseProfile(paused.id);
    const res = await call(matchAction, { user: paused, params: { userId: other.id }, body: { action: 'like' } });
    expect(res.statusCode).toBe(403);
    expect((res.body.error || res.body).code).toBe('PROFILE_HIDDEN');
    expect(await models.Match.count({ where: { userId: paused.id } })).toBe(0);
  });

  // ── deletion grace ─────────────────────────────────────────────────────────

  t('scheduling needs the password, hides the profile, and does not erase yet', async () => {
    const u = await member();
    const wrong = await request(app).post('/api/auth/account/schedule-deletion').set(as(u)).send({ password: 'nope-Nope-1!' });
    expect(wrong.status).toBe(401);
    expect((await models.User.findByPk(u.id)).deletionScheduledFor).toBeNull();

    const ok = await request(app).post('/api/auth/account/schedule-deletion').set(as(u)).send({ password: PASSWORD });
    expect(ok.status).toBe(200);
    const fresh = await models.User.findByPk(u.id);
    const days = (fresh.deletionScheduledFor.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30.01);
    expect(fresh.status).toBe('active');
    expect((await profileOf(u)).isActive).toBe(false);
  });

  t('cancelling restores the profile; a member who had paused stays paused', async () => {
    const u = await member(); const paused = await member();
    await request(app).post('/api/auth/account/schedule-deletion').set(as(u)).send({ password: PASSWORD });
    expect((await request(app).post('/api/auth/account/cancel-deletion').set(as(u))).status).toBe(200);
    expect((await models.User.findByPk(u.id)).deletionScheduledFor).toBeNull();
    expect((await profileOf(u)).isActive).toBe(true);

    await lifecycle.pauseProfile(paused.id);
    await request(app).post('/api/auth/account/schedule-deletion').set(as(paused)).send({ password: PASSWORD });
    await request(app).post('/api/auth/account/cancel-deletion').set(as(paused));
    expect((await profileOf(paused)).isActive).toBe(false);
    expect((await profileOf(paused)).pausedAt).not.toBeNull();
  });

  t('resume is refused while a deletion is scheduled', async () => {
    const u = await member();
    await lifecycle.pauseProfile(u.id);
    await request(app).post('/api/auth/account/schedule-deletion').set(as(u)).send({ password: PASSWORD });
    const res = await request(app).post('/api/profile/me/resume').set(as(u));
    expect(res.status).toBe(409);
    expect((res.body.error || res.body).code).toBe('DELETION_SCHEDULED');
  });

  t('the sweeper erases only accounts whose date has passed', async () => {
    const due = await member(); const later = await member(); const none = await member();
    await models.User.update({ deletionScheduledFor: new Date(Date.now() - 1000) }, { where: { id: due.id } });
    await models.User.update({ deletionScheduledFor: new Date(Date.now() + 5 * DAY) }, { where: { id: later.id } });

    const result = await lifecycle.runScheduledDeletions({ limit: 200 });
    expect(result.erased).toBeGreaterThanOrEqual(1);

    expect((await models.User.findByPk(due.id)).status).toBe('deleted');
    expect((await models.User.findByPk(later.id)).status).toBe('active');
    expect((await models.User.findByPk(none.id)).status).toBe('active');
    expect(await models.Profile.count({ where: { userId: due.id } })).toBe(0);
  });
});
