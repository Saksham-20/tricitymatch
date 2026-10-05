/**
 * Auth correctness (audit P0-8).
 *
 *  - Signup rewrote Gmail addresses (dots and +tags stripped) but login did not,
 *    so a member typing the address they registered with got "Invalid
 *    credentials". One canonical form is now stored and compared, with a
 *    fallback lookup for accounts created under the old rewriting.
 *  - The sanitiser deleted any string starting with `$`, which silently
 *    destroyed passwords (the policy REQUIRES a symbol), chat messages and bios.
 *  - Members with no password (Google-only) crashed bcrypt with a 500 on
 *    forgot/reset/change password.
 */

jest.mock('../../config/env', () => ({
  features: {},
  founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test-secret', jwtExpiry: '15m', refreshTokenExpiry: '7d', resetTokenExpiry: '1h' },
  server: { frontendUrl: 'http://localhost:3000' },
  isProduction: false,
  isDevelopment: true,
  google: { clientId: 'client-id' },
  otp: {},
  sms: {},
  security: { disableRateLimits: true },
  email: { isConfigured: () => true },
}));
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Profile: { findOne: jest.fn().mockResolvedValue({ firstName: 'Asha' }) }, RefreshToken: {}, ReferralCode: {}, MarketingLead: {},
}));
jest.mock('../../utils/accountErasure', () => ({ eraseAccount: jest.fn() }));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendGoogleSignInHelpEmail: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn(), sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));
jest.mock('../../utils/smsService', () => ({ sendOtp: jest.fn(), verifyOtp: jest.fn(), normalizePhone: (p) => p }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/foundingGrant', () => ({ grantFoundingIfOpen: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(), logAudit: jest.fn(),
}));

const { User } = require('../../models');
const { sendPasswordResetEmail, sendGoogleSignInHelpEmail } = require('../../utils/email');
const security = require('../../middlewares/security');
const {
  canonicalEmail, legacyNormalizedEmail, emailLookupCandidates, emailIdentityKey,
} = require('../../utils/emailAddress');
const authController = require('../../controllers/authController');

const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn(), clearCookie: jest.fn() };
  const next = jest.fn();
  handler({ body: {}, query: {}, cookies: {}, ...req }, res, next);
  // forgot-password deliberately sleeps 100-300ms on the not-found path.
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { res, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => jest.clearAllMocks());

describe('email address forms', () => {
  it('stores what the member typed, lower-cased and trimmed — nothing cleverer', () => {
    expect(canonicalEmail('  First.Last+Wed@Gmail.com ')).toBe('first.last+wed@gmail.com');
    expect(canonicalEmail('')).toBeNull();
    expect(canonicalEmail(42)).toBeNull();
  });

  it('also looks under the form the old signup stored, canonical first', () => {
    expect(legacyNormalizedEmail('First.Last+x@Gmail.com')).toBe('firstlast@gmail.com');
    expect(emailLookupCandidates('First.Last@gmail.com')).toEqual(['first.last@gmail.com', 'firstlast@gmail.com']);
    expect(emailLookupCandidates('asha@example.com')).toEqual(['asha@example.com']);
  });

  it('collapses spelling variants of one mailbox into one lockout identity', () => {
    const keys = ['a.b@gmail.com', 'ab@gmail.com', 'A.B+1@gmail.com', 'ab@googlemail.com'].map(emailIdentityKey);
    expect(new Set(keys).size).toBe(1);
    expect(security.loginLookupKey({ identifier: 'A.B@Gmail.com' })).toBe(security.loginLookupKey({ identifier: 'ab+z@gmail.com' }));
    expect(security.loginLookupKey({ identifier: '9876543210' })).toBe('9876543210');
  });
});

describe('sanitiser', () => {
  it('keeps values that start with $ — passwords, messages, bios', () => {
    const body = { password: '$Secret123', message: '$500 budget', bio: ['$ok'] };
    security.sanitizeObject(body);
    expect(body).toEqual({ password: '$Secret123', message: '$500 budget', bio: ['$ok'] });
  });

  it('still drops operator KEYS and null bytes', () => {
    const body = { email: { $gt: '' }, name: 'a\0b', nested: { __proto__x: 1, $where: 'x' } };
    security.sanitizeObject(body);
    expect(body.email).toEqual({});
    expect(body.name).toBe('ab');
    expect(body.nested.$where).toBeUndefined();
  });
});

describe('login lookup', () => {
  it('finds an account stored in the old Gmail-stripped form when the member types the dotted address', async () => {
    const stored = { id: 'u1', password: 'hash', comparePassword: jest.fn().mockResolvedValue(false) };
    User.findOne.mockImplementation(async ({ where }) => (where.email === 'firstlast@gmail.com' ? stored : null));
    const { error } = await run(authController.login, { body: { identifier: 'First.Last@Gmail.com', password: 'x' } });
    const looked = User.findOne.mock.calls.map(([q]) => q.where.email);
    expect(looked).toEqual(['first.last@gmail.com', 'firstlast@gmail.com']);
    expect(stored.comparePassword).toHaveBeenCalled(); // reached the password check, not "no such user"
    expect(error).toMatchObject({ statusCode: 401 });
  });

  it('a new-style account is found on the first lookup', async () => {
    const stored = { id: 'u2', password: 'hash', comparePassword: jest.fn().mockResolvedValue(false) };
    User.findOne.mockImplementation(async ({ where }) => (where.email === 'first.last@gmail.com' ? stored : null));
    await run(authController.login, { body: { identifier: 'first.last@gmail.com', password: 'x' } });
    expect(User.findOne).toHaveBeenCalledTimes(1);
  });
});

describe('members with no password (Google-only)', () => {
  const googleOnly = { id: 'g1', email: 'g@example.com', password: null, comparePassword: jest.fn() };

  it('forgot-password answers the same generic 200 and sends nothing for an account with no way in by mail', async () => {
    User.findOne.mockResolvedValue(googleOnly); // no googleId, so not a Google account either
    const { res, error } = await run(authController.forgotPassword, { body: { email: 'g@example.com' } });
    expect(error).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'If the email exists, a reset link has been sent.' }));
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(sendGoogleSignInHelpEmail).not.toHaveBeenCalled();
    // ...but the log says why, so a "the mail never came" report can be traced.
    const { log } = require('../../middlewares/logger');
    expect(log.info).toHaveBeenCalledWith('Password reset mail not sent', expect.objectContaining({ reason: 'no_password' }));
  });

  it('forgot-password for an unknown address logs no_account and answers the same', async () => {
    User.findOne.mockResolvedValue(null);
    const { res } = await run(authController.forgotPassword, { body: { email: 'nobody@example.com' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'If the email exists, a reset link has been sent.' }));
    const { log } = require('../../middlewares/logger');
    expect(log.info).toHaveBeenCalledWith('Password reset mail not sent', expect.objectContaining({ reason: 'no_account' }));
  });

  it('forgot-password on a Google account mails how to sign in instead of staying silent', async () => {
    User.findOne.mockResolvedValue({ ...googleOnly, id: 'g2', googleId: 'gsub-1', emailVerified: true });
    const { res, error } = await run(authController.forgotPassword, { body: { email: 'g@example.com' } });
    expect(error).toBeUndefined();
    // Same answer as every other case, so it still says nothing about who exists.
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'If the email exists, a reset link has been sent.' }));
    expect(res.json.mock.calls[0][0].resetToken).toBeUndefined();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(sendGoogleSignInHelpEmail).toHaveBeenCalledWith('g@example.com', 'Asha', 'http://localhost:3000/login');
  });

  it('forgot-password on a password account greets the member by their profile name', async () => {
    User.findOne.mockResolvedValue({ id: 'p1', email: 'p@example.com', password: '$2a$hash', emailVerified: true });
    await run(authController.forgotPassword, { body: { email: 'p@example.com' } });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('p@example.com', 'Asha', expect.stringContaining('/reset-password?token='));
  });

  it('change-password is a clear 400, not a 500 from bcrypt', async () => {
    User.findByPk.mockResolvedValue(googleOnly);
    const { error } = await run(authController.changePassword, { user: { id: 'g1' }, body: { currentPassword: 'a', newPassword: 'b' } });
    expect(error).toMatchObject({ statusCode: 400 });
  });

  it('reset-password with a forged token is a 400, not a 500', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 'g1', type: 'password_reset', pwdFp: 'abcd1234abcd1234' }, 'test-secret');
    User.findByPk.mockResolvedValue(googleOnly);
    const { error } = await run(authController.resetPassword, { body: { token, password: 'New@Pass123' } });
    expect(error).toMatchObject({ statusCode: 400 });
  });
});
