/**
 * Signup integrity (audit P0-9).
 *
 *  - `X-App-Client: mobile` is a plain request header any script can send, and it
 *    skipped the verified-contact requirement entirely: unlimited unverified
 *    accounts squatting on other people's emails/phones.
 *  - The "verified" marker was keyed on the contact alone, so anyone could
 *    finish a signup with a contact somebody else had just verified.
 *  - Linking Google to an account whose email was never verified kept the
 *    original registrant's password and sessions (account pre-hijack).
 */

const mockCache = new Map();
jest.mock('../../utils/cache', () => ({
  get: jest.fn(async (k) => mockCache.get(k) ?? null),
  set: jest.fn(async (k, v) => { mockCache.set(k, v); }),
  del: jest.fn(async (k) => { mockCache.delete(k); }),
}));

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: (...a) => mockVerifyIdToken(...a) })),
}));

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
  User: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  Profile: { create: jest.fn() },
  RefreshToken: {
    generateToken: () => 'raw', hashToken: (t) => `hash:${t}`,
    create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
    revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
  },
  ReferralCode: {}, MarketingLead: {},
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn(async (fn) => fn('TXN')) }));
jest.mock('../../utils/accountErasure', () => ({ eraseAccount: jest.fn() }));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined), sendPasswordResetEmail: jest.fn(),
  sendEmail: jest.fn(), sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));
jest.mock('../../utils/smsService', () => ({
  sendOtp: jest.fn(),
  verifyOtp: jest.fn().mockResolvedValue({ success: true }),
  normalizePhone: (p) => `91${String(p).replace(/\D/g, '').slice(-10)}`,
}));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/foundingGrant', () => ({ grantFoundingIfOpen: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(), logAudit: jest.fn(),
}));

const { User, Profile, RefreshToken } = require('../../models');
const { issueProof, consumeProof } = require('../../utils/otpProof');
const authController = require('../../controllers/authController');

const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn(), clearCookie: jest.fn() };
  const next = jest.fn();
  handler({ body: {}, query: {}, cookies: {}, headers: {}, ip: '1.1.1.1', ...req }, res, next);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { res, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCache.clear();
  User.findOne.mockResolvedValue(null);
});

describe('otp proof', () => {
  it('is single-use and bound to the contact it was issued for', async () => {
    const proof = await issueProof('email', 'a@example.com');
    expect(await consumeProof('email', 'b@example.com', proof)).toBe(false);
    expect(await consumeProof('phone', 'a@example.com', proof)).toBe(false);
    expect(await consumeProof('email', 'a@example.com', 'wrong')).toBe(false);
    expect(await consumeProof('email', 'a@example.com', undefined)).toBe(false);
    expect(await consumeProof('email', 'a@example.com', proof)).toBe(true);
    expect(await consumeProof('email', 'a@example.com', proof)).toBe(false);
  });
});

describe('signup', () => {
  const body = { email: 'new@example.com', password: 'Secret@123' };

  it('refuses an account with no proven contact — even with the native-client header', async () => {
    const { error } = await run(authController.signup, { body, headers: { 'x-app-client': 'mobile' } });
    expect(error).toMatchObject({ statusCode: 400 });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('refuses a marker somebody else earned (contact verified, proof not presented)', async () => {
    await issueProof('email', 'new@example.com');
    const { error } = await run(authController.signup, { body });
    expect(error).toMatchObject({ statusCode: 400 });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('refuses a proof issued for a different contact', async () => {
    const other = await issueProof('email', 'other@example.com');
    const { error } = await run(authController.signup, { body: { ...body, emailProof: other } });
    expect(error).toMatchObject({ statusCode: 400 });
  });

  it('creates the account and stamps it verified when the right proof is presented', async () => {
    const proof = await issueProof('email', 'new@example.com');
    User.create.mockResolvedValue({ id: 'u9', email: 'new@example.com', toJSON: () => ({ id: 'u9' }) });
    User.findByPk.mockResolvedValue({ id: 'u9', toJSON: () => ({ id: 'u9', Profile: {} }) });
    Profile.create.mockResolvedValue({});
    await run(authController.signup, { body: { ...body, emailProof: proof } });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: true, phoneVerified: false }), expect.anything());
    // Spent: a second signup with the same proof is refused.
    User.create.mockClear();
    const { error } = await run(authController.signup, { body: { ...body, email: 'new@example.com', emailProof: proof } });
    expect(error).toMatchObject({ statusCode: 400 });
  });
});

describe('Google sign-in linking to an existing email account', () => {
  const payload = { sub: 'g-1', email: 'victim@example.com', email_verified: true, given_name: 'Vic', family_name: 'Tim' };

  const linkTo = (existing) => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
    User.findOne.mockImplementation(async ({ where }) => (where.googleId ? null : where.email === 'victim@example.com' ? existing : null));
  };

  it('drops the registrant\'s password and revokes their sessions when the email was never verified', async () => {
    const squatter = { id: 'u1', email: 'victim@example.com', password: 'squatter-hash', emailVerified: false, status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    linkTo(squatter);
    await run(authController.googleAuth, { body: { credential: 'cred' } });
    expect(squatter.password).toBeNull();
    expect(squatter.emailVerified).toBe(true);
    expect(squatter.googleId).toBe('g-1');
    expect(RefreshToken.revokeAllUserTokens).toHaveBeenCalledWith('u1', expect.any(String));
  });

  it('refuses Google sign-in to an account that has a second factor on', async () => {
    const staff = { id: 'u5', email: 'victim@example.com', password: 'hash', emailVerified: true, googleId: 'g-1', mfaEnabledAt: new Date(), status: 'active', save: jest.fn() };
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
    User.findOne.mockResolvedValue(staff);
    const { error, res } = await run(authController.googleAuth, { body: { credential: 'cred' } });
    expect(error).toMatchObject({ statusCode: 401, code: 'MFA_REQUIRED_PASSWORD_LOGIN' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('leaves a verified account alone', async () => {
    const owner = { id: 'u2', email: 'victim@example.com', password: 'real-hash', emailVerified: true, status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    linkTo(owner);
    await run(authController.googleAuth, { body: { credential: 'cred' } });
    expect(owner.password).toBe('real-hash');
    expect(RefreshToken.revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it('creates new Google members without a placeholder gender or birth date', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ id: 'u3', email: 'victim@example.com', status: 'active', save: jest.fn(), toJSON: () => ({ id: 'u3' }) });
    User.findByPk.mockResolvedValue({ id: 'u3', toJSON: () => ({ id: 'u3', Profile: {} }) });
    await run(authController.googleAuth, { body: { credential: 'cred', termsAccepted: true } });
    const profileArgs = Profile.create.mock.calls[0][0];
    expect(profileArgs.gender).toBeUndefined();
    expect(profileArgs.dateOfBirth).toBeUndefined();
  });
});
