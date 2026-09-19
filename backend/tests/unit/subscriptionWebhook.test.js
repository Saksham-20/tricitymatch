/**
 * Razorpay webhook activation (Phase 2, P2.2).
 *
 * The webhook is the FALLBACK leg: it fires when the browser never came back
 * from checkout, so it is the ONLY thing that activates the purchase. It used
 * to activate the pending row and stop there — while `verifyPayment` (the happy
 * path) also supersedes every other pending/active row. On an upgrade the
 * member still holds the plan they are upgrading FROM, so a webhook-only
 * activation left TWO rows marked 'active'. `requirePremium` does `findOne`
 * with no ORDER BY, so which plan the member gets — and which row's
 * contact-unlock quota is consumed — becomes whatever Postgres returns first.
 *
 * Found live on 2026-08-10 driving a real rzp_test_ payment end to end.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret', keyId: 'rzp_test_x', webhookSecret: 'hook_secret', isConfigured: () => true },
  founding: { endsAt: '', memberCap: 0, isOpen: jest.fn(() => false) },
  isProduction: false,
  isDevelopment: true,
}));

const mockTransaction = jest.fn(async (fn) => fn('TX'));

jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn(), update: jest.fn(), create: jest.fn() },
  User: { update: jest.fn(), findByPk: jest.fn() },
  Profile: {},
  MarketingLead: {},
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

const { Op } = require('sequelize');
const { Subscription, User } = require('../../models');
const { webhook } = require('../../controllers/subscriptionController');

const ORDER = 'order_QA1';
const PAYMENT = 'pay_QA1';

const pendingRow = (planType = 'premium_plus') => ({
  id: 'sub-new',
  userId: 'user-1',
  planType,
  status: 'pending',
  save: jest.fn(),
});

const fire = async (body) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  // asyncHandler doesn't return its inner promise — drain the queue.
  webhook({ body }, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
};

const captured = (order = ORDER) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { order_id: order, id: PAYMENT } } },
});

beforeEach(() => {
  jest.clearAllMocks();
  Subscription.update.mockResolvedValue([1]);
  User.update.mockResolvedValue([1]);
});

describe('payment.captured', () => {
  it('activates the pending row with an explicit unlock cap and an endDate', async () => {
    const row = pendingRow('premium_plus');
    Subscription.findOne
      .mockResolvedValueOnce(null) // idempotency probe
      .mockResolvedValueOnce(row);

    await fire(captured());

    expect(row.status).toBe('active');
    expect(row.razorpayPaymentId).toBe(PAYMENT);
    // NEVER leave this null: null contactUnlocksAllowed means UNLIMITED.
    expect(row.contactUnlocksAllowed).toBe(15);
    expect(row.contactUnlocksUsed).toBe(0);
    expect(row.endDate.getTime()).toBeGreaterThan(Date.now());
    expect(row.save).toHaveBeenCalled();
  });

  it('supersedes every OTHER pending-or-active row, so exactly one stays active', async () => {
    const row = pendingRow();
    Subscription.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

    await fire(captured());

    expect(Subscription.update).toHaveBeenCalledWith(
      { status: 'cancelled' },
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: { [Op.in]: ['pending', 'active'] },
          id: { [Op.ne]: 'sub-new' },
        }),
      })
    );
  });

  it('is idempotent — a redelivered webhook does not re-activate or re-supersede', async () => {
    Subscription.findOne.mockResolvedValueOnce({ id: 'sub-existing', status: 'active' });

    await fire(captured());

    expect(Subscription.update).not.toHaveBeenCalled();
  });

  it('ignores an order it does not recognise', async () => {
    Subscription.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await fire(captured('order_UNKNOWN'));

    expect(Subscription.update).not.toHaveBeenCalled();
  });

  it('grants the boost only on unlimited tiers', async () => {
    const row = pendingRow('vip');
    Subscription.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

    await fire(captured());

    expect(User.update).toHaveBeenCalledWith(
      expect.objectContaining({ isBoosted: true }),
      expect.anything()
    );
  });

  it('does not boost a mid-tier plan', async () => {
    const row = pendingRow('basic_premium');
    Subscription.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

    await fire(captured());

    expect(User.update).not.toHaveBeenCalled();
  });
});

describe('payment.captured on a closed-without-payment order', () => {
  // Razorpay keeps an order payable after the member closes the popup or the
  // stale-order sweeper closes the row. A captured payment is money taken, so
  // the entitlement must follow whatever happened to the row beforehand.
  it('revives a cancelled order that never had a payment attached', async () => {
    const row = { ...pendingRow(), status: 'cancelled', razorpayPaymentId: null };
    Subscription.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

    await fire(captured());

    expect(row.status).toBe('active');
    expect(row.razorpayPaymentId).toBe(PAYMENT);
  });

  it('never revives a cancelled plan that carries a real payment', async () => {
    const row = { ...pendingRow(), status: 'cancelled', razorpayPaymentId: 'pay_OLD' };
    Subscription.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

    await fire(captured());

    expect(row.status).toBe('cancelled');
    expect(row.save).not.toHaveBeenCalled();
  });
});

describe('payment.failed', () => {
  const failed = () => ({
    event: 'payment.failed',
    payload: { payment: { entity: { order_id: ORDER, error_description: 'declined' } } },
  });

  // Was: "cancels the pending row". That was the bug — a Razorpay order takes
  // several attempts, so cancelling on the first failure meant a retry that
  // then SUCCEEDED was rejected by verify-payment ("Subscription not found") or
  // ignored by the captured webhook: paid, and no plan.
  it('keeps the order pending so a retry on the same order can still succeed', async () => {
    const row = pendingRow();
    Subscription.findOne.mockResolvedValueOnce(row);

    await fire(failed());

    expect(row.status).toBe('pending');
    expect(row.contactUnlocksAllowed).toBeUndefined();
  });

  it('records the failure once, for the help mail', async () => {
    const row = pendingRow();
    Subscription.findOne.mockResolvedValueOnce(row);

    await fire(failed());

    expect(row.lifecycleMail.paymentFailedAt).toEqual(expect.any(String));
    const first = row.lifecycleMail.paymentFailedAt;

    // A second failed attempt on the same order must not restart the clock.
    Subscription.findOne.mockResolvedValueOnce(row);
    await fire(failed());
    expect(row.lifecycleMail.paymentFailedAt).toBe(first);
    expect(row.save).toHaveBeenCalledTimes(1);
  });

  it('ignores a failure on an order that is no longer pending', async () => {
    const row = { ...pendingRow(), status: 'active' };
    Subscription.findOne.mockResolvedValueOnce(row);

    await fire(failed());

    expect(row.save).not.toHaveBeenCalled();
  });
});
