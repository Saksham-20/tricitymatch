/**
 * TOTP second factor (audit P0-13): admin, sub-admin and marketing logins had a
 * password and nothing else.
 */

const mockCache = new Map();
jest.mock('../../utils/cache', () => ({
  get: jest.fn(async (k) => mockCache.get(k) ?? null),
  set: jest.fn(async (k, v) => { mockCache.set(k, v); }),
  del: jest.fn(async (k) => { mockCache.delete(k); }),
}));
jest.mock('../../config/env', () => ({
  features: { staffMfaRequired: false },
  founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test-secret-value', jwtExpiry: '15m', refreshTokenExpiry: '7d' },
  server: { frontendUrl: 'http://localhost:3000' },
  isProduction: false, isDevelopment: true,
  google: { clientId: 'client-id' }, otp: {}, sms: {},
  security: { disableRateLimits: true },
  email: { isConfigured: () => true },
}));
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Profile: {}, RefreshToken: { revokeAllUserTokens: jest.fn() }, ReferralCode: {}, MarketingLead: {},
}));
jest.mock('../../utils/accountErasure', () => ({ eraseAccount: jest.fn() }));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendEmail: jest.fn(), sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));
jest.mock('../../utils/smsService', () => ({ sendOtp: jest.fn(), verifyOtp: jest.fn(), normalizePhone: (p) => p }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/foundingGrant', () => ({ grantFoundingIfOpen: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(), logAudit: jest.fn(),
}));

const totp = require('../../utils/totp');
const { checkSecondFactor } = require('../../utils/mfa');
const { User } = require('../../models');
const authController = require('../../controllers/authController');

describe('totp', () => {
  it('matches the RFC 6238 SHA-1 test vector (T=59s -> 287082)', () => {
    const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
    expect(totp.totpAt(secret, 59000)).toBe('287082');
    expect(totp.verifyTotp(secret, '287082', 59000)).toBe(1);
    expect(totp.verifyTotp(secret, '287083', 59000)).toBeNull();
  });

  it('tolerates one step of clock drift and no more', () => {
    const secret = totp.generateSecret();
    const now = 1_700_000_000_000;
    const code = totp.totpAt(secret, now);
    expect(totp.verifyTotp(secret, code, now + 30_000)).not.toBeNull();
    expect(totp.verifyTotp(secret, code, now + 120_000)).toBeNull();
  });

  it('encrypts the secret at rest and refuses tampering', () => {
    const secret = totp.generateSecret();
    const stored = totp.encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(totp.decryptSecret(stored)).toBe(secret);
    const parts = stored.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => totp.decryptSecret(parts.join('.'))).toThrow();
  });

  it('builds an otpauth URI an authenticator can import', () => {
    expect(totp.otpauthUri('ABC234', 'a@b.com')).toMatch(/^otpauth:\/\/totp\/TricityMatch:a%40b\.com\?secret=ABC234&issuer=TricityMatch/);
  });
});

describe('checkSecondFactor', () => {
  const secret = totp.generateSecret();
  const recovery = totp.generateRecoveryCodes();
  const user = () => ({ id: 'u1', mfaSecret: totp.encryptSecret(secret), mfaRecoveryHashes: recovery.hashes });

  beforeEach(() => mockCache.clear());

  it('accepts the current code once and refuses a replay', async () => {
    const code = totp.totpAt(secret);
    expect((await checkSecondFactor(user(), code)).ok).toBe(true);
    expect((await checkSecondFactor(user(), code)).ok).toBe(false);
  });

  it('refuses a wrong code and an empty one', async () => {
    expect((await checkSecondFactor(user(), '000000')).ok).toBe(false);
    expect((await checkSecondFactor(user(), '')).ok).toBe(false);
  });

  it('accepts a recovery code and reports which hash to burn', async () => {
    const r = await checkSecondFactor(user(), recovery.codes[0]);
    expect(r.ok).toBe(true);
    expect(r.recoveryUsed).toBe(recovery.hashes[0]);
  });
});

describe('login with a second factor', () => {
  const secret = totp.generateSecret();
  const mk = () => ({
    id: 'u1', email: 'admin@example.com', password: 'hash', status: 'active', role: 'admin',
    mfaSecret: totp.encryptSecret(secret), mfaEnabledAt: new Date(), mfaRecoveryHashes: [],
    comparePassword: jest.fn().mockResolvedValue(true), save: jest.fn().mockResolvedValue(undefined),
  });
  const run = async (body) => {
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
    const next = jest.fn();
    authController.login({ body, headers: {}, cookies: {}, ip: '1.1.1.1' }, res, next);
    await new Promise((r) => setTimeout(r, 30));
    return { res, error: next.mock.calls[0]?.[0] };
  };

  beforeEach(() => { mockCache.clear(); jest.clearAllMocks(); });

  it('asks for a code after a correct password, without issuing a session', async () => {
    User.findOne.mockResolvedValue(mk());
    const { res, error } = await run({ identifier: 'admin@example.com', password: 'x' });
    expect(error).toMatchObject({ statusCode: 401, code: 'MFA_REQUIRED' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects a wrong code', async () => {
    User.findOne.mockResolvedValue(mk());
    const { error } = await run({ identifier: 'admin@example.com', password: 'x', mfaCode: '000000' });
    expect(error).toMatchObject({ statusCode: 401, code: 'INVALID_MFA_CODE' });
  });

  it('a correct password with a wrong code does not get past the door', async () => {
    const u = mk();
    u.comparePassword.mockResolvedValue(false);
    User.findOne.mockResolvedValue(u);
    const { error } = await run({ identifier: 'admin@example.com', password: 'bad', mfaCode: totp.totpAt(secret) });
    expect(error).toMatchObject({ statusCode: 401 });
    expect(error.code).not.toBe('MFA_REQUIRED');
  });
});
