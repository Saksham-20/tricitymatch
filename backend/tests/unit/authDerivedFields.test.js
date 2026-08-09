/**
 * `GET /auth/me` derived fields (Phase 2, F8).
 *
 * The bug this locks down: `withDerivedUserFields` used to run its OWN
 * subscription query filtered on `status:'active'` with no endDate predicate.
 * Between a subscription expiring and the hourly Bull sweep flipping the row to
 * 'expired', /auth/me answered `subscriptionPlan: 'premium_plus'` while every
 * real gate (`requirePremium`, which does filter endDate) returned 403 — so the
 * UI showed premium affordances that 403'd on click. With Redis down the sweep
 * never runs and the drift is permanent. Reading through
 * `utils/entitlements.getActiveSubscription` is what keeps /auth/me and the
 * gates answering the same question.
 *
 * Also covers the `features` block: the client must learn the flags from the
 * SERVER, never from a build-baked VITE_ var that can drift from it.
 */

jest.mock('../../config/env', () => ({
  features: { freeChatForMutuals: false },
  founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test', jwtExpiry: '15m', refreshTokenExpiry: '7d' },
  server: { frontendUrl: 'http://localhost:3000' },
  isProduction: false,
  isDevelopment: true,
  google: {},
  otp: {},
}));

jest.mock('../../models', () => ({
  User: { findByPk: jest.fn() },
  Profile: {},
  RefreshToken: {},
  ReferralCode: {},
  MarketingLead: {},
}));

jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendEmail: jest.fn(),
  sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));
jest.mock('../../utils/smsService', () => ({}));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/foundingGrant', () => ({ grantFoundingIfOpen: jest.fn() }));
jest.mock('../../middlewares/security', () => ({
  recordFailedLogin: jest.fn(), clearLoginAttempts: jest.fn(),
}));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(), logAudit: jest.fn(),
}));

const config = require('../../config/env');
const { User } = require('../../models');
const { getActiveSubscription } = require('../../utils/entitlements');
const { getMe } = require('../../controllers/authController');

const asUser = (overrides = {}) => ({
  toJSON: () => ({
    id: 'u1',
    email: 'q@example.com',
    Profile: { onboardingComplete: true, firstName: 'QA' },
    ...overrides,
  }),
});

const callGetMe = async () => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  // `asyncHandler` does not RETURN its inner promise (it only attaches .catch),
  // so awaiting the call is not enough — drain the microtask queue first.
  getMe({ user: { id: 'u1' } }, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res.json.mock.calls[0][0].user;
};

beforeEach(() => {
  jest.clearAllMocks();
  config.features.freeChatForMutuals = false;
  config.founding.isOpen.mockReturnValue(false);
  User.findByPk.mockResolvedValue(asUser());
  getActiveSubscription.mockResolvedValue(null);
});

describe('subscriptionPlan', () => {
  it('reports the plan of a live subscription', async () => {
    getActiveSubscription.mockResolvedValue({ planType: 'premium_plus' });
    await expect(callGetMe()).resolves.toMatchObject({ subscriptionPlan: 'premium_plus' });
  });

  it('reports free when the entitlement read finds nothing', async () => {
    await expect(callGetMe()).resolves.toMatchObject({ subscriptionPlan: 'free' });
  });

  it('asks the SAME helper the gates use, so an unswept expired row cannot read as premium', async () => {
    await callGetMe();
    expect(getActiveSubscription).toHaveBeenCalledWith('u1');
  });
});

describe('features block', () => {
  it('mirrors the server flags', async () => {
    config.features.freeChatForMutuals = true;
    config.founding.isOpen.mockReturnValue(true);
    await expect(callGetMe()).resolves.toMatchObject({
      features: { freeChatForMutuals: true, foundingOpen: true },
    });
  });

  it('is present and false-by-default so a client never has to guess', async () => {
    await expect(callGetMe()).resolves.toMatchObject({
      features: { freeChatForMutuals: false, foundingOpen: false },
    });
  });
});

describe('onboardingComplete', () => {
  it('reads the persisted profile flag, not a derivation', async () => {
    User.findByPk.mockResolvedValue(asUser({ Profile: { onboardingComplete: false } }));
    await expect(callGetMe()).resolves.toMatchObject({ onboardingComplete: false });
  });

  it('is false when there is no profile at all', async () => {
    User.findByPk.mockResolvedValue(asUser({ Profile: null }));
    await expect(callGetMe()).resolves.toMatchObject({ onboardingComplete: false });
  });
});
