/**
 * Account flows that broke real members (2026-10-05 audit):
 *  - Google sign-in on a phone member's unproved email wiped their password and
 *    signed them out everywhere; banned / two-step accounts were altered before
 *    being refused; a second Google account silently replaced the first;
 *    staff accounts linked to whoever owned the mailbox; first.last@gmail.com
 *    was not found for firstlast@gmail.com.
 *  - Members who joined by phone could never get a reset email, could not
 *    verify their email, and lost SMS reset once the email was verified.
 *  - Google members could never set a password.
 *  - hasPassword was never reported.
 * Real routes and database; Google's token check, mail and SMS are stubbed.
 */

const PRIOR_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: (...a) => mockVerifyIdToken(...a) })),
}));
const mockMail = {
  reset: jest.fn(async () => true),
  googleHelp: jest.fn(async () => true),
  otp: jest.fn(async () => true),
};
jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: (...a) => mockMail.reset(...a),
  sendGoogleSignInHelpEmail: (...a) => mockMail.googleHelp(...a),
  sendOtpEmail: (...a) => mockMail.otp(...a),
  sendSecurityAlert: jest.fn(async () => true),
}));
const mockSms = { sendOtp: jest.fn(async () => true) };
jest.mock('../../../utils/smsService', () => ({
  sendOtp: (...a) => mockSms.sendOtp(...a),
  verifyOtp: jest.fn(async () => true),
  normalizePhone: (p) => p,
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => true) }));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const rand = () => Math.random().toString(36).slice(2, 10);
const ip = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const flush = () => new Promise((r) => setTimeout(r, 200));

describeDb('account flows', (t) => {
  const ids = [];
  let app; let models; let sequelize;

  beforeAll(() => {
    sequelize = require('../../../config/database');
    models = require('../../../models');
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
    if (ids.length) {
      await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
    if (PRIOR_CLIENT_ID === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = PRIOR_CLIENT_ID;
  });

  beforeEach(() => {
    mockMail.reset.mockClear(); mockMail.googleHelp.mockClear(); mockMail.otp.mockClear(); mockSms.sendOtp.mockClear();
  });

  const mk = async (user = {}, profile = {}) => {
    const m = await makeMember({ user, profile });
    ids.push(m.user.id);
    return m.user;
  };
  const googleAs = (email, sub = `g-${rand()}`) => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub, email, email_verified: true, given_name: 'Gita', family_name: 'Sandhu' }),
    });
    return sub;
  };
  const google = (body = {}) => request(app).post('/api/auth/google').set('X-Forwarded-For', ip()).send({ credential: 'tok', ...body });
  const code = (res) => res.body.error?.code || res.body.code;
  const reload = (u) => models.User.findByPk(u.id);

  // ── Google linking ────────────────────────────────────────────────────────
  t('an account that proved its email is linked on its next Google sign-in, password kept', async () => {
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, emailVerified: true });
    const sub = googleAs(email);
    const res = await google();
    expect(res.status).toBe(200);
    const after = await reload(u);
    expect(after.googleId).toBe(sub);
    expect(after.password).toBeTruthy();
  });

  t('a member who joined by phone with an unproved email is NOT taken over: told to sign in by mobile', async () => {
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, emailVerified: false, phone: phone(), phoneVerified: true });
    googleAs(email);
    const res = await google();
    expect(res.status).toBe(409);
    expect(code(res)).toBe('GOOGLE_LINK_REQUIRES_SIGNIN');
    const after = await reload(u);
    expect(after.googleId).toBeNull();
    expect(after.password).toBeTruthy();
  });

  t('an account with no proved contact at all is still claimed by the mailbox owner', async () => {
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, emailVerified: false, phoneVerified: false });
    googleAs(email);
    const res = await google();
    expect(res.status).toBe(200);
    const after = await reload(u);
    expect(after.googleId).toBeTruthy();
    expect(after.password).toBeNull();
    expect(after.emailVerified).toBe(true);
  });

  t('a different Google account cannot replace the linked one', async () => {
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, emailVerified: true, googleId: `g-orig-${rand()}` });
    googleAs(email, `g-other-${rand()}`);
    const res = await google();
    expect(res.status).toBe(409);
    expect(code(res)).toBe('GOOGLE_ACCOUNT_MISMATCH');
    expect((await reload(u)).googleId).toMatch(/^g-orig-/);
  });

  t('a staff account is never linked through Google', async () => {
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, emailVerified: true, role: 'admin' });
    googleAs(email);
    const res = await google();
    expect(res.status).toBe(403);
    expect((await reload(u)).googleId).toBeNull();
  });

  t('banned and two-step accounts are refused BEFORE anything is changed', async () => {
    const e1 = `af-${rand()}@example.test`;
    const banned = await mk({ email: e1, emailVerified: false, phoneVerified: false, status: 'banned' });
    googleAs(e1);
    expect((await google()).status).toBe(403);
    const b = await reload(banned);
    expect(b.googleId).toBeNull();
    expect(b.password).toBeTruthy();

    const e2 = `af-${rand()}@example.test`;
    const mfa = await mk({ email: e2, emailVerified: false, phoneVerified: false, mfaEnabledAt: new Date() });
    googleAs(e2);
    expect((await google()).status).toBe(401);
    const m = await reload(mfa);
    expect(m.googleId).toBeNull();
    expect(m.password).toBeTruthy();
  });

  t('first.last@gmail.com is found when Google reports firstlast@gmail.com (no duplicate account)', async () => {
    const local = `af${rand()}`;
    const stored = `${local.slice(0, 4)}.${local.slice(4)}@gmail.com`;
    const u = await mk({ email: stored, emailVerified: true });
    googleAs(`${local}@gmail.com`);
    const res = await google();
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(u.id);
    expect(await models.User.count({ where: { email: `${local}@gmail.com` } })).toBe(0);
  });

  // ── hasPassword ───────────────────────────────────────────────────────────
  t('the session user says whether a password exists', async () => {
    const { getMe } = require('../../../controllers/authController');
    const withPw = await mk();
    const googleOnly = await mk({ password: null, googleId: `g-${rand()}`, emailVerified: true });
    expect((await call(getMe, { user: withPw })).body.user.hasPassword).toBe(true);
    expect((await call(getMe, { user: googleOnly })).body.user.hasPassword).toBe(false);
  });

  // ── Verify the email already on the account ──────────────────────────────
  t('a member can verify the email they typed when they joined', async () => {
    const { requestCurrentEmailVerification, confirmCurrentEmailVerification } = require('../../../controllers/authController');
    const u = await mk({ email: `af-${rand()}@example.test`, emailVerified: false, phone: phone(), phoneVerified: true });
    const sent = await call(requestCurrentEmailVerification, { user: u });
    expect(sent.statusCode).toBe(200);
    const mailed = mockMail.otp.mock.calls[0];
    expect(mailed[0]).toBe(u.email);
    const wrong = await call(confirmCurrentEmailVerification, { user: u, body: { code: '000000' === mailed[1] ? '111111' : '000000' } });
    expect(wrong.statusCode).toBeGreaterThanOrEqual(400);
    const ok = await call(confirmCurrentEmailVerification, { user: u, body: { code: mailed[1] } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.user.emailVerified).toBe(true);
    expect((await reload(u)).emailVerified).toBe(true);
  });

  // ── Reset for members who joined by phone ────────────────────────────────
  t('mobile number + the email on the account: a reset link is emailed, and using it verifies the email', async () => {
    const p = phone();
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, emailVerified: false, phone: p, phoneVerified: true });

    const miss = await request(app).post('/api/auth/forgot-password/phone-email').set('X-Forwarded-For', ip()).send({ phone: p, email: `other-${rand()}@example.test` });
    expect(miss.status).toBe(200);
    await flush();
    expect(mockMail.reset).not.toHaveBeenCalled();

    const hit = await request(app).post('/api/auth/forgot-password/phone-email').set('X-Forwarded-For', ip()).send({ phone: p, email: email.toUpperCase() });
    expect(hit.status).toBe(200);
    expect(hit.body.message).toBe(miss.body.message); // same answer either way
    await flush();
    expect(mockMail.reset).toHaveBeenCalledTimes(1);
    const link = mockMail.reset.mock.calls[0][2];
    const token = new URL(link).searchParams.get('token');

    const done = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', ip()).send({ token, password: 'N3w!Password-2026' });
    expect(done.status).toBe(200);
    const after = await reload(u);
    expect(after.emailVerified).toBe(true);
    expect(await after.comparePassword('N3w!Password-2026')).toBe(true);

    // Used once: the same link no longer works.
    const again = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', ip()).send({ token, password: 'An0ther!Pass-2026' });
    expect(again.status).toBe(400);
  });

  t('SMS reset stays available after the email is verified (fallback)', async () => {
    const p = phone();
    await mk({ email: `af-${rand()}@example.test`, emailVerified: true, phone: p, phoneVerified: true });
    const res = await request(app).post('/api/auth/forgot-password/phone').set('X-Forwarded-For', ip()).send({ phone: p });
    expect(res.status).toBe(200);
    expect(mockSms.sendOtp).toHaveBeenCalledTimes(1);
  });

  // ── Google members can set a password ────────────────────────────────────
  t('a Google member gets a one-time "set a password" link with the sign-in help mail', async () => {
    const email = `af-${rand()}@example.test`;
    const u = await mk({ email, password: null, googleId: `g-${rand()}`, emailVerified: true });
    const res = await request(app).post('/api/auth/forgot-password').set('X-Forwarded-For', ip()).send({ email });
    expect(res.status).toBe(200);
    await flush();
    expect(mockMail.reset).not.toHaveBeenCalled();
    expect(mockMail.googleHelp).toHaveBeenCalledTimes(1);
    const setLink = mockMail.googleHelp.mock.calls[0][3];
    const token = new URL(setLink).searchParams.get('token');

    const set = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', ip()).send({ token, password: 'G00gle!Member-2026' });
    expect(set.status).toBe(200);
    expect(await (await reload(u)).comparePassword('G00gle!Member-2026')).toBe(true);
    const again = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', ip()).send({ token, password: 'Other!Pass-2026x' });
    expect(again.status).toBe(400);
  });
});
