/**
 * Refresh-token rotation under concurrency and retry (feature interrogation
 * AUTH-02). Real routes, real Postgres: the race lives in SQL, so a mock could
 * not show it. Outbound mail is replaced.
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => true) }));

const crypto = require('crypto');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const PASSWORD = 'Str0ng!Pass-2026';
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');

const cookieValue = (res, name) => {
  const line = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
  return line ? line.split(';')[0].slice(name.length + 1) : null;
};

describeDb('refresh-token rotation', (t) => {
  const ids = [];
  let app; let sequelize;
  beforeAll(() => {
    sequelize = require('../../../config/database');
    const { sanitizeRequest, extractIp } = require('../../../middlewares/security');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    app = express();
    app.set('trust proxy', true);
    app.use(extractIp);
    app.use(cookieParser('test-cookie-secret-for-testing'));
    app.use(express.json());
    app.use(sanitizeRequest);
    app.use('/api/auth', require('../../../routes/authRoutes'));
    app.use(errorHandler);
  });
  afterAll(async () => {
    if (ids.length) await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const signIn = async () => {
    const m = await makeMember({ user: { password: PASSWORD } });
    ids.push(m.user.id);
    const login = await request(app).post('/api/auth/login').send({ identifier: m.user.email, password: PASSWORD });
    return { user: m.user, token: cookieValue(login, 'refreshToken') };
  };
  const refresh = (token) => request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${token}`);
  const liveRows = (userId) => sequelize.query(
    'SELECT id FROM "RefreshTokens" WHERE "userId" = :userId AND "isRevoked" = false',
    { replacements: { userId } }
  ).then(([rows]) => rows);

  t('simultaneous refreshes with one token: all succeed with the SAME successor, one live row, nobody signed out', async () => {
    const { user, token } = await signIn();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => refresh(token)));

    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const successors = new Set(results.map((r) => cookieValue(r, 'refreshToken')));
    expect(successors.size).toBe(1);
    const [successor] = [...successors];
    expect(successor).not.toBe(token);

    // The family did not fork: exactly one live row, and it is the successor.
    const live = await liveRows(user.id);
    expect(live).toHaveLength(1);

    // And the successor works.
    expect((await refresh(successor)).status).toBe(200);
  });

  t('a retry just after rotation (lost response) gets the same successor, not a sign-out', async () => {
    const { token } = await signIn();
    const first = await refresh(token);
    const retry = await refresh(token);
    expect(retry.status).toBe(200);
    expect(cookieValue(retry, 'refreshToken')).toBe(cookieValue(first, 'refreshToken'));
    expect(retry.body.tokens.refreshToken).toBe(first.body.tokens.refreshToken);
  });

  t('a stale token whose successor has already moved on is refused WITHOUT killing the live session', async () => {
    const { token } = await signIn();
    const a = cookieValue(await refresh(token), 'refreshToken');      // token -> a
    const b = cookieValue(await refresh(a), 'refreshToken');          // a -> b (live)

    const stale = await refresh(token);                               // inside grace, successor (a) already revoked
    expect(stale.status).toBe(401);
    expect(stale.headers['set-cookie'] || []).toHaveLength(0);        // live cookies not wiped
    expect((await refresh(b)).status).toBe(200);                      // b is still good
  });

  t('reuse after the grace window revokes the whole family', async () => {
    const { user, token } = await signIn();
    const next = cookieValue(await refresh(token), 'refreshToken');
    await sequelize.query(
      `UPDATE "RefreshTokens" SET "revokedAt" = NOW() - INTERVAL '10 minutes' WHERE "tokenHash" = :h`,
      { replacements: { h: sha(token) } }
    );
    expect((await refresh(token)).status).toBe(401);
    expect((await refresh(next)).status).toBe(401);
    expect(await liveRows(user.id)).toHaveLength(0);
  });

  t('the successor session row carries lastUsedAt (the revoked row used to get it)', async () => {
    const { token } = await signIn();
    const next = cookieValue(await refresh(token), 'refreshToken');
    const [[row]] = await sequelize.query('SELECT "lastUsedAt" FROM "RefreshTokens" WHERE "tokenHash" = :h', { replacements: { h: sha(next) } });
    expect(row.lastUsedAt).not.toBeNull();
  });

  t('a refresh for a banned member is refused and not rotated', async () => {
    const { user, token } = await signIn();
    await sequelize.query('UPDATE "Users" SET status = \'banned\' WHERE id = :id', { replacements: { id: user.id } });
    expect((await refresh(token)).status).toBe(401);
  });

  t('login history still shows the NEWEST sign-ins for a member with 1000+ rotation rows', async () => {
    const { loginHistory } = require('../../../utils/deviceRecognition');
    const { RefreshToken } = require('../../../models');
    const m = await makeMember({ user: { password: PASSWORD } });
    ids.push(m.user.id);
    const oldFamily = crypto.randomUUID();
    const newFamily = crypto.randomUUID();
    const base = Date.now() - 30 * 86400000;
    const rows = Array.from({ length: 1005 }, (_, i) => ({
      userId: m.user.id, tokenHash: sha(`hist-${m.user.id}-${i}`), family: oldFamily,
      expiresAt: new Date(Date.now() + 86400000), isRevoked: true, createdAt: new Date(base + i * 60000),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    }));
    rows.push({
      userId: m.user.id, tokenHash: sha(`hist-new-${m.user.id}`), family: newFamily,
      expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
    });
    await RefreshToken.bulkCreate(rows);

    const history = await loginHistory(RefreshToken, m.user.id, { limit: 20 });
    expect(history.length).toBe(2);
    expect(history[0].status).toBe('active');            // the new sign-in is listed, and first
    expect(new Date(history[0].signedInAt).getTime()).toBeGreaterThan(Date.now() - 60000);
  });
});
