'use strict';

/**
 * POST /subscription/cancel-order — the member closed the payment popup.
 * "If they cancel, the process should be completely cancelled": the order must
 * not linger in `pending`. `pending` is reserved for a payment that may still
 * resolve, so a failed attempt is the one case that must NOT be cancelled here.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret', keyId: 'rzp_test_x', webhookSecret: 'hook_secret', isConfigured: () => true },
  founding: { endsAt: '', memberCap: 0, isOpen: jest.fn(() => false) },
  isProduction: false,
  isDevelopment: true,
}));
jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn(), update: jest.fn(), create: jest.fn() },
  User: { update: jest.fn(), findByPk: jest.fn() },
  Profile: {},
  MarketingLead: {},
  UnlockPurchase: { findOne: jest.fn() },
}));
jest.mock('../../config/database', () => ({ transaction: (fn) => fn('TX') }));
jest.mock('../../utils/email', () => ({ sendSubscriptionConfirmation: jest.fn() }));
jest.mock('../../utils/invoice', () => ({ generateInvoicePDF: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { Subscription } = require('../../models');
const { cancelOrder } = require('../../controllers/subscriptionController');
const { logAudit } = require('../../middlewares/logger');

const call = async (body = { razorpayOrderId: 'order_QA1' }) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  cancelOrder({ user: { id: 'user-1' }, body }, res, next);
  await new Promise((resolve) => setImmediate(resolve)); // asyncHandler drops the promise
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res.json.mock.calls[0][0];
};

const pending = (ledger = null) => ({ id: 'sub-1', planType: 'premium_plus', status: 'pending', lifecycleMail: ledger });

beforeEach(() => {
  jest.clearAllMocks();
  Subscription.update.mockResolvedValue([1]);
});

describe('cancel-order', () => {
  it("closes the member's own unpaid pending order, stamping when they walked away", async () => {
    Subscription.findOne.mockResolvedValueOnce(pending());

    expect(await call()).toEqual({ success: true, cancelled: true });

    expect(Subscription.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', razorpayOrderId: 'order_QA1', status: 'pending', razorpayPaymentId: null },
    });
    expect(Subscription.update).toHaveBeenCalledWith(
      { status: 'cancelled', lifecycleMail: { cancelledAt: expect.any(String) } },
      { where: { id: 'sub-1', status: 'pending', razorpayPaymentId: null } }
    );
    expect(logAudit).toHaveBeenCalledWith('subscription_order_cancelled', 'user-1', expect.any(Object));
  });

  it('leaves an order with a failed attempt PENDING — that is a payment problem, not a change of mind', async () => {
    Subscription.findOne.mockResolvedValueOnce(pending({ paymentFailedAt: '2026-09-19T10:00:00.000Z' }));

    expect(await call()).toEqual({ success: true, cancelled: false, reason: 'payment_issue' });
    expect(Subscription.update).not.toHaveBeenCalled();
  });

  it('never overwrites an order that was paid between the read and the write', async () => {
    Subscription.findOne.mockResolvedValueOnce(pending());
    Subscription.update.mockResolvedValueOnce([0]);

    expect(await call()).toEqual({ success: true, cancelled: false });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('is idempotent and never an error: an unknown or already-closed order is a quiet no-op', async () => {
    Subscription.findOne.mockResolvedValueOnce(null);

    expect(await call()).toEqual({ success: true, cancelled: false });
    expect(Subscription.update).not.toHaveBeenCalled();
  });

  it("can only close the caller's own order (scoped by userId in the query)", async () => {
    Subscription.findOne.mockResolvedValueOnce(null);
    await call({ razorpayOrderId: 'order_SOMEONE_ELSES' });

    expect(Subscription.findOne.mock.calls[0][0].where.userId).toBe('user-1');
  });
});
