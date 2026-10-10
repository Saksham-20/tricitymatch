/**
 * Moving the Terms version asks every member who accepted an older one to
 * accept again before anything else works, and accepting lets them straight
 * back in. Driven end to end with real tokens, the real auth middleware, the
 * real /auth routes and the real database, so a version bump cannot strand
 * members behind a screen they cannot get past.
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));
jest.mock('../../../utils/smsService', () => ({
  sendOtp: jest.fn(async () => ({ success: true })),
  verifyOtp: jest.fn(async () => ({ success: true })),
  normalizePhone: jest.fn((p) => p),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

describeDb('Terms re-acceptance after a version bump', (t) => {
  const ids = [];
  let app;
  let config;
  let TERMS_VERSION;
  let User;

  const sign = (userId) => jwt.sign({ userId, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' });
  const member = async (user = {}) => {
    const m = await makeMember({ user });
    ids.push(m.user.id);
    return m.user;
  };
  const errorOf = (res) => res.body.error || res.body;

  beforeAll(() => {
    config = require('../../../config/env');
    ({ TERMS_VERSION } = require('../../../constants/legal'));
    ({ User } = require('../../../models'));
    const { auth } = require('../../../middlewares/auth');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/v1/auth', require('../../../routes/authRoutes'));
    // Stands in for any ordinary signed-in route.
    app.get('/api/v1/profile/me', auth, (req, res) => res.json({ ok: true, id: req.user.id }));
    app.use(errorHandler);
  });

  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "AuditLogs" WHERE "actorId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });

  t('the current version is the one the legal pages show', () => {
    expect(TERMS_VERSION).toBe('2026-10-10');
  });

  const roundTrip = async (acceptedVersion) => {
    const u = await member({ termsVersion: acceptedVersion });
    const h = { Authorization: `Bearer ${sign(u.id)}` };

    // 1. Everything ordinary is held back, with a code the clients branch on.
    const blocked = await request(app).get('/api/v1/profile/me').set(h);
    expect(blocked.status).toBe(403);
    expect(errorOf(blocked).code).toBe('TERMS_RECONSENT_REQUIRED');

    // 2. The client can still load the member, and is told to ask.
    const me = await request(app).get('/api/v1/auth/me').set(h);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      id: u.id,
      termsVersion: acceptedVersion,
      requiresReconsent: true,
      currentTermsVersion: TERMS_VERSION,
    });

    // 3. Accepting the version the client was shown records it.
    const accepted = await request(app)
      .post('/api/v1/auth/accept-terms')
      .set(h)
      .send({ termsVersion: me.body.user.currentTermsVersion, accepted: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ success: true, termsVersion: TERMS_VERSION, requiresReconsent: false });
    const row = await User.findByPk(u.id, { attributes: ['termsVersion', 'termsAcceptedAt', 'consent'] });
    expect(row.termsVersion).toBe(TERMS_VERSION);
    expect(row.termsAcceptedAt).toBeInstanceOf(Date);
    expect(row.consent.termsVersion).toBe(TERMS_VERSION);

    // 4. And the member is straight back in.
    const after = await request(app).get('/api/v1/profile/me').set(h);
    expect(after.status).toBe(200);
    expect(after.body.id).toBe(u.id);
    expect((await request(app).get('/api/v1/auth/me').set(h)).body.user.requiresReconsent).toBe(false);
  };

  t('a member who accepted the 2 October Terms is asked again, and accepting lets them back in', async () => {
    await roundTrip('2026-10-02');
  });

  t('so is a member on the version every consent record carried until now (26 August)', async () => {
    await roundTrip('2026-08-26');
  });

  t('accepting a version other than the current one is refused and changes nothing', async () => {
    const u = await member({ termsVersion: '2026-08-26' });
    const h = { Authorization: `Bearer ${sign(u.id)}` };
    const stale = await request(app).post('/api/v1/auth/accept-terms').set(h).send({ termsVersion: '2026-08-26', accepted: true });
    expect(stale.status).toBe(409);
    expect((await User.findByPk(u.id, { attributes: ['termsVersion'] })).termsVersion).toBe('2026-08-26');
    expect((await request(app).get('/api/v1/profile/me').set(h)).status).toBe(403);
  });

  t('a member with no recorded version (account older than consent records) is not blocked', async () => {
    const u = await member({ termsVersion: null });
    const h = { Authorization: `Bearer ${sign(u.id)}` };
    expect((await request(app).get('/api/v1/profile/me').set(h)).status).toBe(200);
    const me = await request(app).get('/api/v1/auth/me').set(h);
    expect(me.status).toBe(200);
    expect(me.body.user.requiresReconsent).toBe(false);
  });
});
