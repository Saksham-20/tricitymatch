/**
 * Cancellation must never issue an automatic refund (2026-09-17).
 *
 * `DELETE /subscription/current` used to compute a pro-rata Razorpay refund
 * on every cancellation. For an UNLIMITED plan (contactUnlocksAllowed ===
 * null — the only plan on sale since 2026-08-22, `premium_plus`) the
 * unlock-usage term of that computation was hardcoded to 1 (fully unused),
 * so the refund collapsed to time-elapsed only: buy the plan, drain the
 * `UNLIMITED_DAILY_UNLOCK_CAP` for ten days, cancel, and get ~89% of the
 * price back having already taken ~250 phone numbers — repeatable with a
 * fresh account. This suite proves the refund call is gone entirely and that
 * cancellation itself still behaves correctly (status flips, boost clears,
 * response stays a compatible shape). A genuine refund is now a manual admin
 * action — see adminRefund.test.js.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret', keyId: 'rzp_test_x', webhookSecret: 'hook_secret', isConfigured: () => true },
  founding: { endsAt: '', memberCap: 0, isOpen: jest.fn(() => false) },
  limits: { unlimitedDailyUnlockCap: 25 },
  isProduction: false,
  isDevelopment: true,
}));

const mockTransaction = jest.fn(async (fn) => fn('TX'));

jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn(), update: jest.fn(), create: jest.fn() },
  User: { update: jest.fn(), findByPk: jest.fn() },
  Profile: {},
  MarketingLead: { findOne: jest.fn() },
  UnlockPurchase: { findOne: jest.fn() },
}));
jest.mock('../../config/database', () => ({ transaction: (fn) => mockTransaction(fn) }));
jest.mock('../../utils/email', () => ({ sendSubscriptionConfirmation: jest.fn() }));
jest.mock('../../utils/invoice', () => ({ generateInvoicePDF: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

// If cancelSubscription ever again reaches for a live Razorpay instance, this
// mock makes that call explosive and visible instead of silently succeeding
// against the real (unconfigured in test) SDK.
const mockRefund = jest.fn();
const mockGetRazorpayInstance = jest.fn(() => ({ payments: { refund: mockRefund } }));
jest.mock('../../utils/razorpay', () => {
  const actual = jest.requireActual('../../utils/razorpay');
  return { ...actual, getRazorpayInstance: mockGetRazorpayInstance };
});

const { Subscription, User } = require('../../models');
const { logAudit } = require('../../middlewares/logger');
const { cancelSubscription } = require('../../controllers/subscriptionController');

const activeUnlimitedRow = (overrides = {}) => ({
  id: 'sub-unlimited',
  userId: 'user-1',
  planType: 'premium_plus',
  status: 'active',
  startDate: new Date(Date.now() - 10 * 86400000),
  endDate: new Date(Date.now() + 80 * 86400000), // day 10 of a 90-day term
  amount: 1099,
  razorpayPaymentId: 'pay_live_123',
  contactUnlocksAllowed: null, // unlimited — the ONLY plan on sale
  contactUnlocksUsed: 250, // harvested via the 25/day cap over 10 days
  save: jest.fn(),
  ...overrides,
});

const call = async (row) => {
  Subscription.findOne.mockResolvedValueOnce(row);
  const req = { user: { id: 'user-1' } };
  const res = { json: jest.fn() };
  const next = jest.fn();
  cancelSubscription(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  User.update.mockResolvedValue([1]);
});

describe('cancelSubscription — no automatic refund', () => {
  it('never touches the Razorpay instance for an unlimited plan with unlocks already spent', async () => {
    await call(activeUnlimitedRow());

    expect(mockGetRazorpayInstance).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('never touches the Razorpay instance for a finite plan either', async () => {
    await call(activeUnlimitedRow({
      id: 'sub-finite',
      planType: 'basic_premium',
      contactUnlocksAllowed: 5,
      contactUnlocksUsed: 0, // fully unused — the old code would have refunded ~100%
    }));

    expect(mockGetRazorpayInstance).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('responds with refund: null rather than a computed amount', async () => {
    const res = await call(activeUnlimitedRow());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, refund: null })
    );
  });

  it('still cancels the row and clears the boost', async () => {
    const row = activeUnlimitedRow();
    await call(row);

    expect(row.status).toBe('cancelled');
    expect(row.save).toHaveBeenCalled();
    expect(User.update).toHaveBeenCalledWith(
      { isBoosted: false, boostExpiresAt: null },
      expect.objectContaining({ where: { id: 'user-1' } })
    );
  });

  it('audits the cancellation without a refund result', async () => {
    await call(activeUnlimitedRow());

    expect(logAudit).toHaveBeenCalledWith(
      'subscription_cancelled',
      'user-1',
      expect.objectContaining({ subscriptionId: 'sub-unlimited' })
    );
    // The old dangling `refundResult` field must not reappear on the audit row.
    const [, , details] = logAudit.mock.calls[0];
    expect(details.refundResult).toBeUndefined();
  });

  it('404s when there is no active subscription to cancel', async () => {
    Subscription.findOne.mockResolvedValueOnce(null);
    const req = { user: { id: 'user-1' } };
    const res = { json: jest.fn() };
    const next = jest.fn();
    cancelSubscription(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });
});
