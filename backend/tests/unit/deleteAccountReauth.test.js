/**
 * Deleting an account requires re-authentication (audit P0-7).
 *
 * Members who registered with Google have no password. The handler compared a
 * password on every call, so bcrypt threw on the null hash, the endpoint
 * returned 500, and a Google-only member had no working way to erase their
 * account (the DPDP erasure right, and a Google Play requirement).
 */

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: (...a) => mockVerifyIdToken(...a) })),
}));

jest.mock('../../config/env', () => ({
  features: {},
  founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test', jwtExpiry: '15m', refreshTokenExpiry: '7d' },
  server: { frontendUrl: 'http://localhost:3000' },
  isProduction: false,
  isDevelopment: true,
  google: { clientId: 'client-id' },
  otp: {},
}));
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() },
  Profile: {}, RefreshToken: {}, ReferralCode: {}, MarketingLead: {},
}));
jest.mock('../../utils/accountErasure', () => ({ eraseAccount: jest.fn().mockResolvedValue({}) }));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendEmail: jest.fn(),
  sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
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
const { eraseAccount } = require('../../utils/accountErasure');
const { deleteAccount } = require('../../controllers/authController');

const call = async (body) => {
  const res = { json: jest.fn(), clearCookie: jest.fn(), cookie: jest.fn() };
  const next = jest.fn();
  deleteAccount({ user: { id: 'u1' }, body }, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return { res, error: next.mock.calls[0]?.[0] };
};

const passwordMember = (valid) => ({ id: 'u1', password: 'hashed', googleId: null, comparePassword: jest.fn().mockResolvedValue(valid) });
const googleMember = { id: 'u1', password: null, googleId: 'g-123', comparePassword: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('password members', () => {
  it('erase with the right password', async () => {
    User.findByPk.mockResolvedValue(passwordMember(true));
    const { res, error } = await call({ password: 'Secret@123' });
    expect(error).toBeUndefined();
    expect(eraseAccount).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('are refused with the wrong password, and nothing is erased', async () => {
    User.findByPk.mockResolvedValue(passwordMember(false));
    const { error } = await call({ password: 'nope' });
    expect(error).toMatchObject({ statusCode: 401 });
    expect(eraseAccount).not.toHaveBeenCalled();
  });

  it('are refused without a password, and a Google credential is not a substitute', async () => {
    User.findByPk.mockResolvedValue(passwordMember(true));
    const { error } = await call({ googleCredential: 'token' });
    expect(error).toMatchObject({ statusCode: 400 });
    expect(eraseAccount).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});

describe('Google-only members (no password)', () => {
  it('erase after a fresh credential for the SAME Google identity', async () => {
    User.findByPk.mockResolvedValue(googleMember);
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'g-123' }) });
    const { error } = await call({ googleCredential: 'fresh-token' });
    expect(error).toBeUndefined();
    expect(eraseAccount).toHaveBeenCalledWith('u1');
    expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: 'fresh-token', audience: 'client-id' });
  });

  it('are refused when the credential belongs to a different Google account', async () => {
    User.findByPk.mockResolvedValue(googleMember);
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'someone-else' }) });
    const { error } = await call({ googleCredential: 'other-token' });
    expect(error).toMatchObject({ statusCode: 401 });
    expect(eraseAccount).not.toHaveBeenCalled();
  });

  it('are refused on an invalid or expired credential', async () => {
    User.findByPk.mockResolvedValue(googleMember);
    mockVerifyIdToken.mockRejectedValue(new Error('Token used too late'));
    const { error } = await call({ googleCredential: 'stale' });
    expect(error).toMatchObject({ statusCode: 401 });
    expect(eraseAccount).not.toHaveBeenCalled();
  });

  it('are told what to do when no credential is sent (a 400, not the old 500)', async () => {
    User.findByPk.mockResolvedValue(googleMember);
    const { error } = await call({});
    expect(error).toMatchObject({ statusCode: 400 });
    expect(eraseAccount).not.toHaveBeenCalled();
  });

  it('never compares a password against a null hash', async () => {
    User.findByPk.mockResolvedValue(googleMember);
    await call({ password: 'anything' });
    expect(googleMember.comparePassword).not.toHaveBeenCalled();
  });
});

describe('an account with neither a password nor a Google identity', () => {
  it('is refused rather than erased on no proof at all', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', password: null, googleId: null, comparePassword: jest.fn() });
    const { error } = await call({ googleCredential: 'token' });
    expect(error).toMatchObject({ statusCode: 400 });
    expect(eraseAccount).not.toHaveBeenCalled();
  });
});
