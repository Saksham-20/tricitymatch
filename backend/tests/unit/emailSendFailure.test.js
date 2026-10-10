/**
 * A refused code mail must be reported as refused.
 *
 * utils/email never throws: when the provider refuses (daily quota spent,
 * provider down, nothing configured) `sendEmail` RESOLVES { success: false }.
 * The code paths below used to ignore that value and answer "OTP sent", so a
 * member waited for a code that never left, with no hint to try their phone.
 * Each one now drops the code it issued and answers 503 EMAIL_SEND_FAILED.
 */

jest.mock('../../config/env', () => ({
  features: {},
  founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test', jwtExpiry: '15m', refreshTokenExpiry: '7d', resetTokenExpiry: '1h' },
  server: { frontendUrl: 'http://localhost:3000' },
  email: { isConfigured: () => true },
  isProduction: true,
  isDevelopment: false,
  google: {},
  otp: {},
}));
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), update: jest.fn() },
  Profile: {}, RefreshToken: {}, ReferralCode: {}, MarketingLead: {},
}));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendEmail: jest.fn(),
  sendGoogleSignInHelpEmail: jest.fn(), sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));
jest.mock('../../utils/emailBudget', () => ({ spendEmailBudget: jest.fn(async () => true) }));
jest.mock('../../utils/otpStore', () => ({
  spendSend: jest.fn(async () => undefined),
  issue: jest.fn(async () => '123456'),
  discard: jest.fn(async () => undefined),
  verify: jest.fn(async () => undefined),
}));
jest.mock('../../utils/smsService', () => ({ sendOtp: jest.fn(), verifyOtp: jest.fn() }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/foundingGrant', () => ({ grantFoundingIfOpen: jest.fn() }));
jest.mock('../../middlewares/security', () => ({ recordFailedLogin: jest.fn(), clearLoginAttempts: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(), logAudit: jest.fn(),
}));

const { User } = require('../../models');
const { sendOtpEmail } = require('../../utils/email');
const otpStore = require('../../utils/otpStore');
const { log } = require('../../middlewares/logger');
const { sendOtp, requestCurrentEmailVerification, requestEmailChange } = require('../../controllers/authController');

const call = async (handler, req) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  handler(req, res, next);
  // asyncHandler does not return its promise; let the chain settle.
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  return { res, error: next.mock.calls[0]?.[0] };
};

const REFUSED = { success: false, error: 'You have reached your daily email sending quota' };

beforeEach(() => {
  jest.clearAllMocks();
  User.findOne.mockResolvedValue(null);
  User.findAll.mockResolvedValue([]);
});

describe('signup code (POST /auth/send-otp, email)', () => {
  test('a refused send answers 503 EMAIL_SEND_FAILED, points to the phone path and drops the code', async () => {
    sendOtpEmail.mockResolvedValue(REFUSED);
    const { res, error } = await call(sendOtp, { body: { type: 'email', target: 'riya@example.com' } });

    expect(res.json).not.toHaveBeenCalled();
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('EMAIL_SEND_FAILED');
    expect(error.message).toMatch(/couldn't send the email code/i);
    expect(error.message).toMatch(/mobile number/i);
    expect(otpStore.discard).toHaveBeenCalledWith('email', 'riya@example.com');
    expect(log.warn).toHaveBeenCalledWith('Signup email code not sent', expect.objectContaining({ reason: REFUSED.error }));
  });

  test('a delivered code still answers success and keeps the code', async () => {
    sendOtpEmail.mockResolvedValue({ success: true, messageId: 'm1' });
    const { res, error } = await call(sendOtp, { body: { type: 'email', target: 'riya@example.com' } });

    expect(error).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'OTP sent to email' });
    expect(otpStore.discard).not.toHaveBeenCalled();
  });

  test('a spent daily mail budget answers the same code and points to the phone path, issuing nothing', async () => {
    const { spendEmailBudget } = require('../../utils/emailBudget');
    spendEmailBudget.mockResolvedValueOnce(false);
    const { error } = await call(sendOtp, { body: { type: 'email', target: 'riya@example.com' } });

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('EMAIL_SEND_FAILED');
    expect(error.message).toMatch(/mobile number/i);
    expect(otpStore.issue).not.toHaveBeenCalled();
    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  test('a send that throws still drops the code and passes the error on', async () => {
    sendOtpEmail.mockRejectedValue(new Error('boom'));
    const { error } = await call(sendOtp, { body: { type: 'email', target: 'riya@example.com' } });

    expect(error.message).toBe('boom');
    expect(otpStore.discard).toHaveBeenCalledWith('email', 'riya@example.com');
  });
});

describe('logged-in email codes', () => {
  test('verify-the-email-on-file: a refused send answers 503 and drops the code', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', email: 'riya@example.com', emailVerified: false });
    sendOtpEmail.mockResolvedValue(REFUSED);
    const { res, error } = await call(requestCurrentEmailVerification, { user: { id: 'u1' }, body: {} });

    expect(res.json).not.toHaveBeenCalled();
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('EMAIL_SEND_FAILED');
    expect(error.message).toBe("We couldn't send the email just now. Please try again in a few minutes.");
    expect(otpStore.discard).toHaveBeenCalledWith('email-verify', 'u1:riya@example.com');
  });

  test('change-email: a refused send answers 503 and drops the code', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', email: 'old@example.com', password: null });
    sendOtpEmail.mockResolvedValue(REFUSED);
    const { res, error } = await call(requestEmailChange, { user: { id: 'u1' }, body: { newEmail: 'new@example.com' } });

    expect(res.json).not.toHaveBeenCalled();
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('EMAIL_SEND_FAILED');
    expect(otpStore.discard).toHaveBeenCalledWith('email-change', 'u1:new@example.com');
  });

  test('change-email: a delivered code answers success', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', email: 'old@example.com', password: null });
    sendOtpEmail.mockResolvedValue({ success: true });
    const { res, error } = await call(requestEmailChange, { user: { id: 'u1' }, body: { newEmail: 'new@example.com' } });

    expect(error).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Verification code sent to your new email' });
    expect(otpStore.discard).not.toHaveBeenCalled();
  });
});
