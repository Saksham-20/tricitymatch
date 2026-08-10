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

describe('payment.failed', () => {
  it('cancels the pending row and grants nothing', async () => {
    const row = pendingRow();
    Subscription.findOne.mockResolvedValueOnce(row);

    await fire({
      event: 'payment.failed',
      payload: { payment: { entity: { order_id: ORDER, error_description: 'declined' } } },
    });

    expect(row.status).toBe('cancelled');
    expect(row.contactUnlocksAllowed).toBeUndefined();
  });
});
