/**
 * Data export (audit P0-14). The consent copy promises "see, correct, export or
 * erase" — export did not exist.
 */

jest.mock('../../config/env', () => ({
  features: {}, founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test', jwtExpiry: '15m', refreshTokenExpiry: '7d' },
  server: { frontendUrl: 'http://localhost:3000' }, isProduction: false, isDevelopment: true,
  google: { clientId: 'client-id' }, otp: {}, sms: {}, security: { disableRateLimits: true },
  email: { isConfigured: () => true },
}));

const rows = (extra = {}) => jest.fn().mockResolvedValue([{ id: 'r1', ...extra }]);
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn() },
  Profile: { findOne: jest.fn().mockResolvedValue({ id: 'p1', firstName: 'Asha' }) },
  Match: { findAll: jest.fn().mockResolvedValue([{ id: 'm1', matchedUserId: 'other' }]) },
  Message: { findAll: jest.fn().mockResolvedValue([{ id: 'msg1', senderId: 'me', receiverId: 'other', content: 'hi' }]) },
  Notification: { findAll: jest.fn().mockResolvedValue([]) },
  Subscription: { findAll: jest.fn().mockResolvedValue([]) },
  UnlockPurchase: { findAll: jest.fn().mockResolvedValue([]) },
  ContactUnlock: { findAll: jest.fn().mockResolvedValue([]) },
  ProfileView: { findAll: jest.fn().mockResolvedValue([]) },
  Block: { findAll: jest.fn().mockResolvedValue([]) },
  Report: { findAll: jest.fn().mockResolvedValue([]) },
  Verification: { findAll: jest.fn().mockResolvedValue([]) },
  GroupMember: { findAll: jest.fn().mockResolvedValue([]) },
  GroupMessage: { findAll: jest.fn().mockResolvedValue([]) },
  GuardianLink: { findAll: jest.fn().mockResolvedValue([]) },
  AstrologerBooking: { findAll: jest.fn().mockResolvedValue([]) },
  ContactMessage: { findAll: jest.fn().mockResolvedValue([]) },
  AnalyticsEvent: { findAll: jest.fn().mockResolvedValue([]) },
  RefreshToken: { findAll: jest.fn().mockResolvedValue([{ id: 'rt1', userAgent: 'x' }]) },
  ReferralCode: {}, MarketingLead: {},
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

const models = require('../../models');
const { buildMemberExport } = require('../../utils/dataExport');
const { exportMyData } = require('../../controllers/authController');

const member = (over = {}) => ({
  id: 'me', email: 'a@example.com', phone: null, password: 'hash', googleId: null, mfaEnabledAt: null,
  emailVerified: true, phoneVerified: false, role: 'user', status: 'active',
  comparePassword: jest.fn().mockResolvedValue(true), ...over,
});

const call = async (body) => {
  const res = { setHeader: jest.fn(), send: jest.fn(), json: jest.fn() };
  const next = jest.fn();
  exportMyData({ user: { id: 'me' }, body }, res, next);
  await new Promise((r) => setTimeout(r, 30));
  return { res, error: next.mock.calls[0]?.[0] };
};

describe('buildMemberExport', () => {
  it('includes the member\'s own records and none of the credentials', async () => {
    models.User.findByPk.mockResolvedValue(member());
    const out = await buildMemberExport('me');
    expect(out.account).toMatchObject({ id: 'me', email: 'a@example.com' });
    expect(out.profile).toMatchObject({ firstName: 'Asha' });
    expect(out.messages).toHaveLength(1);
    expect(out.interestsYouSent[0].matchedUserId).toBe('other');
    const json = JSON.stringify(out);
    expect(json).not.toContain('hash');
    expect(json).not.toMatch(/tokenHash|mfaSecret|razorpaySignature|fcmTokens/);
  });

  it('asks the database to leave secrets out of the columns it reads', async () => {
    models.User.findByPk.mockResolvedValue(member());
    await buildMemberExport('me');
    const sigExclude = models.Subscription.findAll.mock.calls.at(-1)[0].attributes.exclude;
    expect(sigExclude).toEqual(expect.arrayContaining(['razorpaySignature']));
    const tokenExclude = models.RefreshToken.findAll.mock.calls.at(-1)[0].attributes.exclude;
    expect(tokenExclude).toEqual(expect.arrayContaining(['token', 'tokenHash']));
  });
});

describe('POST /auth/me/export', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires the password and refuses a wrong one', async () => {
    models.User.findByPk.mockResolvedValue(member({ comparePassword: jest.fn().mockResolvedValue(false) }));
    const { error, res } = await call({ password: 'nope' });
    expect(error).toMatchObject({ statusCode: 401 });
    expect(res.send).not.toHaveBeenCalled();
    const none = await call({});
    expect(none.error).toMatchObject({ statusCode: 400 });
  });

  it('returns a JSON attachment for the right password', async () => {
    models.User.findByPk.mockResolvedValue(member());
    const { error, res } = await call({ password: 'Secret@123' });
    expect(error).toBeUndefined();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringMatching(/attachment; filename="tricitymatch-my-data-\d{4}-\d{2}-\d{2}\.json"/));
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(JSON.parse(res.send.mock.calls[0][0]).account.id).toBe('me');
  });
});
