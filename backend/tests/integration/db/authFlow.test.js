/**
 * Authentication through the real routes, middleware and database (audit P1-13).
 *
 * This replaces a suite that mocked every model: it had drifted so far from the
 * controllers that six of its cases failed on a 500 and nobody noticed, because
 * it was never part of the routine run. Nothing here is mocked except outbound
 * mail and the log sink.
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const PASSWORD = 'Str0ng!Pass-2026';

const buildApp = () => {
  const { sanitizeRequest, extractIp } = require('../../../middlewares/security');
  const { errorHandler, notFoundHandler } = require('../../../middlewares/errorHandler');
  const app = express();
  app.set('trust proxy', true);
  app.use(extractIp);
  app.use(cookieParser('test-cookie-secret-for-testing'));
  app.use(express.json());
  app.use(sanitizeRequest);
  app.use('/api/auth', require('../../../routes/authRoutes'));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const cookieValue = (res, name) => {
  const line = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
  return line ? line.split(';')[0].slice(name.length + 1) : null;
};

describeDb('auth over real routes', (t) => {
  const ids = [];
  let app;
  beforeAll(() => { app = buildApp(); });
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const member = async (user = {}) => {
    const m = await makeMember({ user: { password: PASSWORD, ...user } });
    ids.push(m.user.id);
    return m.user;
  };

  t('logs in with the right password: cookies set, no credential fields in the body', async () => {
    const u = await member();
    const res = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();
    const dump = JSON.stringify(res.body);
    expect(dump).not.toContain('"password"');
    expect(dump).not.toContain(u.password || 'hash-never-present');
    expect(res.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
  });

  t('a wrong password and an unknown account give the same answer', async () => {
    const u = await member();
    const wrong = await request(app).post('/api/auth/login').send({ identifier: u.email, password: 'nope-Nope-1!' });
    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'nobody-here@example.test', password: 'nope-Nope-1!' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message || wrong.body.error?.message).toBe(unknown.body.message || unknown.body.error?.message);
  });

  t('a banned account with the right password is refused', async () => {
    const u = await member({ status: 'banned' });
    const res = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(cookieValue(res, 'accessToken')).toBeNull();
  });

  t('five failures lock the account: even the right password is then refused', async () => {
    const u = await member();
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ identifier: u.email, password: `bad-${i}-Xx!` });
    }
    const res = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(cookieValue(res, 'accessToken')).toBeNull();
    const { clearLoginAttempts } = require('../../../middlewares/security');
    await clearLoginAttempts(u.email.toLowerCase());
  });

  t('a refresh token rotates once; replaying it AFTER the grace window is refused and kills the family', async () => {
    const u = await member();
    const login = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    const first = cookieValue(login, 'refreshToken');

    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${first}`);
    expect(rotated.status).toBe(200);
    const second = cookieValue(rotated, 'refreshToken');
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);

    // Age the rotation past the replay grace window: now it is genuine reuse.
    const sequelize = require('../../../config/database');
    await sequelize.query(
      `UPDATE "RefreshTokens" SET "revokedAt" = NOW() - INTERVAL '5 minutes' WHERE "tokenHash" = :h`,
      { replacements: { h: require('crypto').createHash('sha256').update(first).digest('hex') } }
    );

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${first}`);
    expect(replay.status).toBe(401);
    // The legitimate successor is dead too: reuse means the family is compromised.
    const successor = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${second}`);
    expect(successor.status).toBe(401);
  });

  t('the stored refresh token is a hash, never the raw value', async () => {
    const sequelize = require('../../../config/database');
    const u = await member();
    const login = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    const raw = cookieValue(login, 'refreshToken');
    const [rows] = await sequelize.query('SELECT "token", "tokenHash" FROM "RefreshTokens" WHERE "userId" = :id', { replacements: { id: u.id } });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.token).toBeNull();
      expect(r.tokenHash).not.toBe(raw);
    }
  });

  t('/me needs a session and never returns the password hash', async () => {
    const u = await member();
    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toMatch(/"password"|fcmTokens|googleId/);
  });

  t('signup without a verified-contact proof creates nothing', async () => {
    const { User } = require('../../../models');
    const email = `nosignup-${Date.now()}@example.test`;
    const res = await request(app).post('/api/auth/signup').send({
      email, password: PASSWORD, termsAccepted: true, firstName: 'No', lastName: 'Proof',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await User.count({ where: { email } })).toBe(0);
  });
});
