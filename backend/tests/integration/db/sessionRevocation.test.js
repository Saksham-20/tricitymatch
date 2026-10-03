/**
 * Signing a session out ends its ACCESS token too (feature interrogation
 * AUTH-05), plus the account-security notices around password / email changes
 * (AUTH-08) and the lockout clearing after a reset (AUTH-06). Real routes and
 * database; mail is replaced.
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
  sendOtpEmail: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => true) }));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const PASSWORD = 'Str0ng!Pass-2026';
const NEW_PASSWORD = 'N3w_Password-2027';

describeDb('session revocation and security notices', (t) => {
  const ids = [];
  let app; let sequelize; let email;
  beforeAll(() => {
    sequelize = require('../../../config/database');
    email = require('../../../utils/email');
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
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    if (ids.length) await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const newMember = async (over = {}) => {
    const m = await makeMember({ user: { password: PASSWORD, emailVerified: true, ...over } });
    ids.push(m.user.id);
    return m.user;
  };
  const signIn = async (u) => {
    const res = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { access: res.body.tokens.accessToken, refresh: res.body.tokens.refreshToken };
  };
  const me = (access) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${access}`);
  const flush = () => new Promise((r) => setImmediate(r));
  // The reset link forgot-password mails (the token is only echoed in dev).
  const resetLinkFor = async (u) => {
    const crypto = require('crypto');
    const config = require('../../../config/env');
    const [[row]] = await sequelize.query('SELECT password, email FROM "Users" WHERE id = :id', { replacements: { id: u.id } });
    const fp = (v) => crypto.createHash('sha256').update(v).digest('hex').substring(0, 16);
    return jwt.sign({ userId: u.id, type: 'password_reset', pwdFp: fp(row.password), em: fp(row.email.toLowerCase()) }, config.auth.jwtSecret, { expiresIn: '1h' });
  };
  // JWT `iat` has one-second resolution and a sign-in in the same second as a
  // cutoff is deliberately honoured; step past it so the test models "later".
  const tick = () => new Promise((r) => setTimeout(r, 1100));

  t('logout-all ends every access token immediately', async () => {
    const u = await newMember();
    const a = await signIn(u);
    const b = await signIn(u);
    expect((await me(a.access)).status).toBe(200);
    await tick();
    expect((await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${a.access}`)).status).toBe(200);
    expect((await me(a.access)).status).toBe(401);
    expect((await me(b.access)).status).toBe(401);
    // ...and signing in again straight after works.
    const c = await signIn(u);
    expect((await me(c.access)).status).toBe(200);
  });

  t('revoking one session ends that device only, including a recently rotated token', async () => {
    const u = await newMember();
    const phone = await signIn(u);
    const laptop = await signIn(u);
    // The phone refreshed once; its access token still carries the OLD session id.
    await tick();
    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken: phone.refresh });
    const phoneNow = refreshed.body.tokens.accessToken;
    expect((await me(phoneNow)).status).toBe(200);

    const sessions = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${laptop.access}`);
    const phoneSession = sessions.body.sessions.find((s) => s.id === jwt.decode(phoneNow).sid);
    expect(phoneSession).toBeTruthy();

    const del = await request(app).delete(`/api/auth/sessions/${phoneSession.id}`).set('Authorization', `Bearer ${laptop.access}`);
    expect(del.status).toBe(200);
    expect((await me(phoneNow)).status).toBe(401);
    expect((await me(phone.access)).status).toBe(401);   // pre-rotation token of the same device
    expect((await me(laptop.access)).status).toBe(200);  // the other device is untouched
  });

  t('changing the password signs out OTHER devices at once and notifies the member', async () => {
    const u = await newMember();
    const here = await signIn(u);
    const elsewhere = await signIn(u);
    const res = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${here.access}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    await flush();
    expect((await me(elsewhere.access)).status).toBe(401);
    expect((await me(here.access)).status).toBe(200);
    expect(email.sendSecurityAlert).toHaveBeenCalledWith(u.email, expect.anything(), 'Your password was changed', expect.any(String), expect.any(String));
  });

  t('logout ends the access token it was made with', async () => {
    const u = await newMember();
    const a = await signIn(u);
    expect((await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${a.access}`).send({ refreshToken: a.refresh })).status).toBe(200);
    expect((await me(a.access)).status).toBe(401);
  });

  t('an email change notifies the OLD address, signs out other devices, and kills old reset links', async () => {
    const u = await newMember();
    const here = await signIn(u);
    const elsewhere = await signIn(u);
    // A reset link mailed to the old address before the change.
    const oldLink = await resetLinkFor(u);

    // Apply the change through the same code path the OTP flow ends in.
    const otpStore = require('../../../utils/otpStore');
    const newAddr = `moved-${Date.now()}@example.test`;
    const code = await otpStore.issue('email-change', `${u.id}:${newAddr}`, { digits: 6 });
    const verified = await request(app).post('/api/auth/change-email/verify').set('Authorization', `Bearer ${here.access}`).send({ newEmail: newAddr, code });
    expect(verified.status).toBe(200);
    await flush();

    expect(email.sendSecurityAlert).toHaveBeenCalledWith(u.email, expect.anything(), 'Your account email was changed', expect.any(String), expect.any(String));
    expect((await me(elsewhere.access)).status).toBe(401);
    expect((await me(here.access)).status).toBe(200);

    const used = await request(app).post('/api/auth/reset-password').send({ token: oldLink, password: NEW_PASSWORD });
    expect(used.status).toBe(400);
  });

  t('a completed email reset clears the lockout earned with the old password', async () => {
    const u = await newMember();
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ identifier: u.email, password: `bad-${i}-Xx!` });
    }
    expect((await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD })).status).toBe(429);

    const reset = await request(app).post('/api/auth/reset-password').send({ token: await resetLinkFor(u), password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ identifier: u.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
  });

  t('the lock message says how long (and carries Retry-After)', async () => {
    const u = await newMember();
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ identifier: u.email, password: `bad-${i}-Xx!` });
    }
    const res = await request(app).post('/api/auth/login').send({ identifier: u.email, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/locked.*in about \d+ minutes?/i);
    expect(res.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    const { clearLoginAttempts } = require('../../../middlewares/security');
    await clearLoginAttempts(u.email.toLowerCase());
  });

  t('forgot-password: an unproved email beside a verified phone gets no reset mail; a verified one does', async () => {
    const squatted = await newMember({ emailVerified: false, phoneVerified: true, phone: `9${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')}` });
    const ok = await newMember({ emailVerified: true });
    const ask = (addr, ip) => request(app).post('/api/auth/forgot-password').set('X-Forwarded-For', ip).send({ email: addr });

    expect((await ask(squatted.email, '203.0.113.7')).status).toBe(200);
    await flush();
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();

    expect((await ask(ok.email, '203.0.113.8')).status).toBe(200);
    await flush();
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  t('forgot-password mail is capped per member (3/hour) without changing the answer', async () => {
    const u = await newMember({ emailVerified: true });
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/auth/forgot-password').set('X-Forwarded-For', `203.0.113.${20 + i}`).send({ email: u.email });
      expect(res.status).toBe(200);
      await flush();
    }
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(3);
  });
});
