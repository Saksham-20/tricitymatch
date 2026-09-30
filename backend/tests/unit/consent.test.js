/**
 * Consent evidence (audit P1-8): signup must carry an explicit acceptance, a
 * guardian-made profile needs the operator's attestation, marketing is a separate
 * unticked choice, and a Terms version bump forces re-acceptance.
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

const { User, Profile } = require('../../models');
const { issueProof } = require('../../utils/otpProof');
const authController = require('../../controllers/authController');
const { TERMS_VERSION, needsReconsent } = require('../../constants/legal');
const { signupValidation } = require('../../validators');
const { validationResult } = require('express-validator');

const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn(), clearCookie: jest.fn() };
  const next = jest.fn();
  handler({ body: {}, query: {}, cookies: {}, headers: {}, ip: '9.9.9.9', get: (h) => (h === 'user-agent' ? 'TestAgent/1.0' : undefined), ...req }, res, next);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { res, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCache.clear();
  User.findOne.mockResolvedValue(null);
});

describe('signup validation', () => {
  const check = async (body) => {
    const req = { body };
    await Promise.all(signupValidation.map((v) => v.run(req)));
    return validationResult(req).array().map((e) => e.path);
  };
  const ok = { email: 'a@example.com', password: 'Secret@123', termsAccepted: true };

  it('refuses a request that does not assert termsAccepted', async () => {
    expect(await check({ ...ok, termsAccepted: undefined })).toContain('termsAccepted');
    expect(await check({ ...ok, termsAccepted: false })).toContain('termsAccepted');
    expect(await check({ ...ok, termsAccepted: 'yes' })).toContain('termsAccepted');
  });

  it('accepts true and "true" (multipart clients)', async () => {
    expect(await check(ok)).not.toContain('termsAccepted');
    expect(await check({ ...ok, termsAccepted: 'true' })).not.toContain('termsAccepted');
  });

  it('rejects an unknown creatingFor value', async () => {
    expect(await check({ ...ok, creatingFor: 'boss' })).toContain('creatingFor');
    expect(await check({ ...ok, creatingFor: 'other' })).not.toContain('creatingFor'); // what the web sends
    expect(await check({ ...ok, relationshipToProfile: 'cousin-twice-removed' })).toContain('relationshipToProfile');
  });
});

describe('signup consent record', () => {
  const base = { email: 'new@example.com', password: 'Secret@123', termsAccepted: true };
  const create = async (extra = {}) => {
    const proof = await issueProof('email', 'new@example.com');
    User.create.mockResolvedValue({ id: 'u9', email: 'new@example.com', toJSON: () => ({ id: 'u9' }) });
    User.findByPk.mockResolvedValue({ id: 'u9', toJSON: () => ({ id: 'u9', Profile: {} }) });
    Profile.create.mockResolvedValue({});
    const out = await run(authController.signup, { body: { ...base, emailProof: proof, ...extra } });
    return { ...out, created: User.create.mock.calls[0]?.[0] };
  };

  it('records the version, when, from where, and the marketing choice', async () => {
    const { created } = await create();
    expect(created.termsVersion).toBe(TERMS_VERSION);
    expect(created.consent).toMatchObject({ termsVersion: TERMS_VERSION, ip: '9.9.9.9', userAgent: 'TestAgent/1.0', marketing: false });
    expect(created.consent.acceptedAt).toEqual(expect.any(String));
  });

  it('unticked marketing means opted out from the start; ticked does not', async () => {
    const off = await create();
    expect(off.created.lifecycleMail).toEqual({ emailOptOut: expect.any(String) });
    User.create.mockClear();
    const on = await create({ marketingConsent: true });
    expect(on.created.lifecycleMail).toBeUndefined();
    expect(on.created.consent.marketing).toBe(true);
  });

  it('a profile made for someone else needs the operator attestation', async () => {
    const proof = await issueProof('email', 'new@example.com');
    const { error } = await run(authController.signup, { body: { ...base, emailProof: proof, creatingFor: 'parent' } });
    expect(error).toMatchObject({ statusCode: 400 });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('records who the profile is for and when the operator attested', async () => {
    const { created } = await create({ creatingFor: 'parent', subjectAttestation: true });
    expect(created.consent.createdFor).toBe('parent');
    expect(created.consent.subjectAttestedAt).toEqual(expect.any(String));
  });

  it('a self profile needs no attestation', async () => {
    const { error } = await create({ creatingFor: 'self' });
    expect(error).toBeUndefined();
  });
});

describe('Google sign-up', () => {
  const payload = { sub: 'g-1', email: 'new@example.com', email_verified: true, given_name: 'A', family_name: 'B' };
  it('refuses to create an account without an explicit acceptance', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
    User.findOne.mockResolvedValue(null);
    const { error } = await run(authController.googleAuth, { body: { credential: 'c' } });
    expect(error).toMatchObject({ statusCode: 400 });
    expect(User.create).not.toHaveBeenCalled();
  });
});

describe('re-consent', () => {
  it('needsReconsent: only a recorded, different version', () => {
    expect(needsReconsent({ termsVersion: null })).toBe(false); // pre-record accounts
    expect(needsReconsent({ termsVersion: TERMS_VERSION })).toBe(false);
    expect(needsReconsent({ termsVersion: '2020-01-01' })).toBe(true);
    expect(needsReconsent(null)).toBe(false);
  });

  const member = (over = {}) => ({ id: 'u1', consent: { termsVersion: '2020-01-01', acceptedAt: '2020-01-02T00:00:00.000Z', history: [] }, save: jest.fn(async () => {}), ...over });

  it('accept-terms refuses a version the member was not shown, and a missing acceptance', async () => {
    User.findByPk.mockResolvedValue(member());
    let out = await run(authController.acceptTerms, { user: { id: 'u1' }, body: { termsVersion: '1999', accepted: true } });
    expect(out.error).toMatchObject({ statusCode: 409 });
    out = await run(authController.acceptTerms, { user: { id: 'u1' }, body: { termsVersion: TERMS_VERSION, accepted: false } });
    expect(out.error).toMatchObject({ statusCode: 400 });
  });

  it('accept-terms stamps the current version and keeps the earlier acceptance in history', async () => {
    const m = member();
    User.findByPk.mockResolvedValue(m);
    const { res, error } = await run(authController.acceptTerms, { user: { id: 'u1' }, body: { termsVersion: TERMS_VERSION, accepted: true } });
    expect(error).toBeUndefined();
    expect(m.termsVersion).toBe(TERMS_VERSION);
    expect(m.consent.termsVersion).toBe(TERMS_VERSION);
    expect(m.consent.history).toEqual([{ termsVersion: '2020-01-01', acceptedAt: '2020-01-02T00:00:00.000Z' }]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresReconsent: false }));
  });
});

describe('auth middleware enforces re-consent', () => {
  const jwt = require('jsonwebtoken');
  let auth;
  beforeAll(() => {
    jest.resetModules();
    jest.doMock('../../models', () => ({
      User: { findByPk: jest.fn(async () => ({ id: 'u1', status: 'active', role: 'user', termsVersion: '2020-01-01' })) },
      Subscription: {}, ContactUnlock: {}, RefreshToken: {},
    }));
    jest.doMock('../../utils/entitlements', () => ({ hasChatAccess: jest.fn(), getActiveSubscription: jest.fn() }));
    jest.doMock('../../config/env', () => ({
      auth: { jwtSecret: 'test-secret' }, isProduction: false, isDevelopment: true, security: {}, server: {},
    }));
    ({ auth } = require('../../middlewares/auth'));
  });

  const call = async (method, originalUrl) => {
    const token = jwt.sign({ userId: 'u1', type: 'access' }, 'test-secret');
    const req = { method, originalUrl, header: (h) => (h === 'Authorization' ? `Bearer ${token}` : undefined), headers: {}, cookies: {}, query: {} };
    const next = jest.fn();
    auth(req, {}, next);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    return next;
  };

  it('blocks ordinary routes with TERMS_RECONSENT_REQUIRED', async () => {
    for (const [m, u] of [['GET', '/api/v1/search?page=1'], ['POST', '/api/v1/match/abc'], ['GET', '/api/v1/chat/conversations']]) {
      const err = (await call(m, u)).mock.calls[0][0];
      expect(err).toMatchObject({ statusCode: 403, code: 'TERMS_RECONSENT_REQUIRED' });
    }
  });

  it('still serves what the member needs to accept, sign out, export or leave', async () => {
    for (const [m, u] of [
      ['GET', '/api/v1/auth/me'], ['POST', '/api/v1/auth/accept-terms'], ['POST', '/api/v1/auth/logout'],
      ['POST', '/api/v1/auth/me/export'], ['DELETE', '/api/v1/auth/account'], ['GET', '/api/auth/me'],
    ]) {
      expect((await call(m, u)).mock.calls[0][0]).toBeUndefined();
    }
  });
});
