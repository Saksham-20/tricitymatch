/**
 * Phone-OTP password reset (audit P2). The SMS provider is replaced: this test
 * must never send a real text, and the code store has its own tests.
 */

jest.mock('../../../utils/smsService', () => {
  const { AppError } = require('../../../middlewares/errorHandler');
  return {
    normalizePhone: (p) => String(p || '').replace(/\D/g, '').slice(-10),
    sendOtp: jest.fn(async () => ({ success: true })),
    verifyOtp: jest.fn(async (phone, code) => {
      if (String(code) !== '123456') throw new AppError('Invalid OTP. 4 attempts remaining.', 400);
      return { success: true };
    }),
  };
});
jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const OLD = 'Str0ng!Pass-2026';
const NEW = 'N3w!Password-2026';
const phone = () => `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

describeDb('phone-OTP password reset', (t) => {
  const ids = [];
  let app; let sms; let email; let RefreshToken;
  beforeAll(() => {
    sms = require('../../../utils/smsService');
    email = require('../../../utils/email');
    ({ RefreshToken } = require('../../../models'));
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
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  // Phone-only member: verified number, no email address on file.
  const phoneOnly = async (over = {}) => {
    const number = phone();
    const m = await makeMember({ user: { password: OLD, phone: number, phoneVerified: true, email: null, emailVerified: false, ...over } });
    ids.push(m.user.id);
    return { user: m.user, number };
  };
  // A fresh client address per request: the per-IP reset limiter (3/hour) is real
  // and shared by this whole file, and is not what these tests are about.
  const freshIp = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const ask = (number) => request(app).post('/api/auth/forgot-password/phone').set('X-Forwarded-For', freshIp()).send({ phone: number });
  const submit = (number, code = '123456', password = NEW) => request(app).post('/api/auth/reset-password/phone').set('X-Forwarded-For', freshIp()).send({ phone: number, code, password });

  t('a phone-only member gets a code and can set a new password with it', async () => {
    const { user, number } = await phoneOnly();
    await RefreshToken.create({ userId: user.id, tokenHash: 'a'.repeat(64), family: '00000000-0000-4000-8000-000000000009', expiresAt: new Date(Date.now() + 86400000) });

    expect((await ask(number)).status).toBe(200);
    expect(sms.sendOtp).toHaveBeenCalledTimes(1);

    const done = await submit(number);
    expect(done.status).toBe(200);

    const { User } = require('../../../models');
    const fresh = await User.findByPk(user.id);
    expect(await fresh.comparePassword(NEW)).toBe(true);
    expect(await fresh.comparePassword(OLD)).toBe(false);
    expect(await RefreshToken.count({ where: { userId: user.id, isRevoked: false } })).toBe(0);

    const login = await request(app).post('/api/auth/login').send({ identifier: number, password: NEW });
    expect(login.status).toBe(200);
  });

  t('a wrong code changes nothing', async () => {
    const { user, number } = await phoneOnly();
    await ask(number);
    const res = await submit(number, '000000');
    expect(res.status).toBe(400);
    const { User } = require('../../../models');
    expect(await (await User.findByPk(user.id)).comparePassword(OLD)).toBe(true);
  });

  t('unknown and ineligible numbers get the same answer and no text is sent', async () => {
    const known = await phoneOnly();
    const unknown = await ask(phone());
    const knownRes = await ask(known.number);
    expect(unknown.status).toBe(knownRes.status);
    expect(unknown.body).toEqual(knownRes.body);

    sms.sendOtp.mockClear();
    const withEmail = await phoneOnly({ email: `has-email-${Date.now()}@example.test`, emailVerified: true });
    const staff = await phoneOnly({ role: 'admin' });
    const googleOnly = await phoneOnly({ password: null });
    const unverified = await phoneOnly({ phoneVerified: false });
    const banned = await phoneOnly({ status: 'banned' });
    for (const c of [withEmail, staff, googleOnly, unverified, banned]) {
      const r = await ask(c.number);
      expect(r.body).toEqual(knownRes.body);
    }
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  t('the reset step gives one answer whether the account exists, is ineligible, or the code is wrong', async () => {
    const eligible = await phoneOnly();
    const staff = await phoneOnly({ role: 'admin' });
    const a = await submit(phone(), '123456');
    const b = await submit(staff.number, '123456');
    const c = await submit(eligible.number, '999999');
    expect([a.status, b.status, c.status]).toEqual([400, 400, 400]);
    const msg = (r) => (r.body.error || r.body).message;
    expect(msg(a)).toBe(msg(b));
    expect(msg(b)).toBe(msg(c));
    // and the staff account was not changed by the "correct" code
    const { User } = require('../../../models');
    expect(await (await User.findByPk(staff.user.id)).comparePassword(OLD)).toBe(true);
  });

  t('a weak new password is refused before the code is checked', async () => {
    const { number } = await phoneOnly();
    const res = await submit(number, '123456', 'weak');
    expect(res.status).toBe(400);
    expect(sms.verifyOtp).not.toHaveBeenCalled();
  });

  t('an email alert goes out only if the account has an address', async () => {
    const withUnverifiedEmail = await phoneOnly({ email: `unverified-${Date.now()}@example.test`, emailVerified: false });
    expect((await submit(withUnverifiedEmail.number)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(email.sendSecurityAlert).toHaveBeenCalledTimes(1);
  });
});
