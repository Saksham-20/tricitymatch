/**
 * Manual admin refund (2026-09-17).
 *
 * Replaces the automatic pro-rata refund removed from
 * `DELETE /subscription/current` (see subscriptionCancellation.test.js). A
 * refund is now always a deliberate admin action: a human reads the request
 * against the published Refund & Conduct Policy and types the rupee amount
 * in — it is never computed from the plan, the elapsed term or unlock usage.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret', keyId: 'rzp_test_x', webhookSecret: 'hook_secret', isConfigured: () => true },
  limits: { unlimitedDailyUnlockCap: 25 },
  isProduction: false,
  isDevelopment: true,
}));

jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), update: jest.fn() },
  Profile: {},
  Subscription: { findByPk: jest.fn() },
  Match: {},
  Verification: {},
  ProfileView: {},
  Report: {},
  ReferralCode: {},
  MarketingLead: {},
  SuccessStory: {},
  ContactMessage: {},
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn(async (fn) => fn('TX')) }));
jest.mock('../../utils/invoice', () => ({ generateInvoicePDF: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendVerificationApproved: jest.fn(),
  sendVerificationRejected: jest.fn(),
  sendSupportReply: jest.fn(),
}));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const mockRefund = jest.fn();
const mockGetRazorpayInstance = jest.fn(() => ({ payments: { refund: mockRefund } }));
jest.mock('../../utils/razorpay', () => ({
  getRazorpayInstance: mockGetRazorpayInstance,
}));

const { Subscription } = require('../../models');
const { notify } = require('../../utils/notifyUser');
const { logAudit } = require('../../middlewares/logger');
const { refundSubscription } = require('../../controllers/adminController');

const paidSub = (overrides = {}) => ({
  id: 'sub-1',
  userId: 'user-1',
  amount: 1099,
  razorpayPaymentId: 'pay_abc123',
  razorpaySignature: 'sig_abc123',
  User: { id: 'user-1', email: 'member@example.com' },
  ...overrides,
});

const call = async (body, params = { subscriptionId: 'sub-1' }) => {
  const req = { params, body, user: { id: 'admin-1' } };
  const res = { json: jest.fn() };
  const next = jest.fn();
  refundSubscription(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  // Some tests short-circuit BEFORE calling Subscription.findByPk (e.g. the
  // amount validation), which would leave that test's queued
  // `mockResolvedValueOnce` unconsumed and bleeding into the next test —
  // `clearAllMocks` clears call history but not a queued once-implementation.
  // Explicit reset keeps every test's queued value scoped to itself.
  Subscription.findByPk.mockReset();
  mockRefund.mockResolvedValue({ id: 're_test_1' });
});

describe('adminController.refundSubscription', () => {
  it('issues a refund for exactly the admin-supplied amount, not a computed one', async () => {
    Subscription.findByPk.mockResolvedValueOnce(paidSub());

    const res = await call({ amount: 500, reason: 'goodwill — service outage' });

    expect(mockGetRazorpayInstance).toHaveBeenCalled();
    expect(mockRefund).toHaveBeenCalledWith('pay_abc123', expect.objectContaining({ amount: 50000 }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, refund: { refundId: 're_test_1', amount: 500 } })
    );
  });

  it('rejects a zero or negative amount without calling Razorpay', async () => {
    Subscription.findByPk.mockResolvedValueOnce(paidSub());

    await expect(call({ amount: 0 })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('refuses to refund more than was actually paid', async () => {
    Subscription.findByPk.mockResolvedValueOnce(paidSub({ amount: 1099 }));

    await expect(call({ amount: 5000 })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('404s for an unknown subscription', async () => {
    Subscription.findByPk.mockResolvedValueOnce(null);

    await expect(call({ amount: 100 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a subscription with no Razorpay payment (free/granted plan)', async () => {
    Subscription.findByPk.mockResolvedValueOnce(paidSub({ razorpayPaymentId: null }));

    await expect(call({ amount: 100 })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('refuses a Google Play purchase — that rail has no Razorpay payment id', async () => {
    Subscription.findByPk.mockResolvedValueOnce(
      paidSub({ razorpayPaymentId: 'gplay_token_xyz', razorpaySignature: 'GOOGLE_PLAY' })
    );

    await expect(call({ amount: 100 })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('records who refunded what via logAudit', async () => {
    Subscription.findByPk.mockResolvedValueOnce(paidSub());

    await call({ amount: 500, reason: 'seven-day window' });

    expect(logAudit).toHaveBeenCalledWith(
      'subscription_refunded_manual',
      'admin-1',
      expect.objectContaining({
        subscriptionId: 'sub-1',
        userId: 'user-1',
        amountPaise: 50000,
        reason: 'seven-day window',
        razorpayRefundId: 're_test_1',
      })
    );
  });

  it('notifies the member the refund was issued', async () => {
    Subscription.findByPk.mockResolvedValueOnce(paidSub());

    await call({ amount: 500 });

    expect(notify).toHaveBeenCalledWith(
      'user-1',
      'system',
      expect.any(String),
      expect.stringContaining('500.00')
    );
  });
});
