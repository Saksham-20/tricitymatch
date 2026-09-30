/**
 * Refunds, disputes and invoices (audit P0-12).
 */

const mockTxn = jest.fn(async (fn) => fn('TXN'));
jest.mock('../../config/database', () => ({ transaction: (...a) => mockTxn(...a) }));
jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn(), count: jest.fn() },
  User: { update: jest.fn() },
  MarketingLead: { findOne: jest.fn() },
}));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { Subscription, User, MarketingLead } = require('../../models');
const { notify } = require('../../utils/notifyUser');
const { recordRefund, recordDispute } = require('../../utils/paymentRefunds');
const { invoiceBlocker } = require('../../utils/invoiceEligibility');

const sub = (over = {}) => ({
  id: 's1', userId: 'u1', planType: 'premium_plus', status: 'active', amount: '1099.00', refundedAmount: '0.00',
  refunds: null, razorpayPaymentId: 'pay_1', endDate: new Date(Date.now() + 86400000),
  save: jest.fn().mockResolvedValue(undefined), ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  Subscription.count.mockResolvedValue(0);
  MarketingLead.findOne.mockResolvedValue(null);
});

describe('recordRefund', () => {
  it('a full refund ends the plan, withdraws the boost and reverses the rep credit', async () => {
    const s = sub({ planType: 'vip' }); // VIP/NRI are the boosted plans
    Subscription.findOne.mockResolvedValue(s);
    const lead = { paymentId: 'pay_1', paymentStatus: 'paid', amountPaid: '1099', save: jest.fn() };
    MarketingLead.findOne.mockResolvedValue(lead);

    const out = await recordRefund({ paymentId: 'pay_1', refundId: 'rfnd_1', amountPaise: 109900, source: 'webhook' });

    expect(out).toMatchObject({ matched: true, full: true });
    expect(s.status).toBe('cancelled');
    expect(Number(s.refundedAmount)).toBe(1099);
    expect(User.update).toHaveBeenCalledWith({ isBoosted: false, boostExpiresAt: null }, expect.anything());
    expect(lead.paymentStatus).toBe('none');
    expect(notify).toHaveBeenCalledWith('u1', 'system', 'Refund processed', expect.stringContaining('₹1099.00'));
  });

  it('a partial refund nets the money but leaves the plan alone', async () => {
    const s = sub();
    Subscription.findOne.mockResolvedValue(s);
    const out = await recordRefund({ paymentId: 'pay_1', refundId: 'rfnd_2', amountPaise: 30000, source: 'admin' });
    expect(out.full).toBe(false);
    expect(s.status).toBe('active');
    expect(s.refundedAmount).toBe(300);
    expect(User.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled(); // admin action notifies on its own
  });

  it('is idempotent per refund id (a redelivered webhook changes nothing)', async () => {
    const s = sub({ refunds: [{ id: 'rfnd_1', amount: 300 }], refundedAmount: '300.00' });
    Subscription.findOne.mockResolvedValue(s);
    const out = await recordRefund({ paymentId: 'pay_1', refundId: 'rfnd_1', amountPaise: 30000, source: 'webhook' });
    expect(out.duplicate).toBe(true);
    expect(s.save).not.toHaveBeenCalled();
  });

  it('two partials that add up to the price end the plan', async () => {
    const s = sub({ refunds: [{ id: 'a', amount: 500 }], refundedAmount: '500.00' });
    Subscription.findOne.mockResolvedValue(s);
    const out = await recordRefund({ paymentId: 'pay_1', refundId: 'b', amountPaise: 59900, source: 'webhook' });
    expect(out.full).toBe(true);
    expect(s.status).toBe('cancelled');
  });

  it('never records more than was paid', async () => {
    const s = sub();
    Subscription.findOne.mockResolvedValue(s);
    await recordRefund({ paymentId: 'pay_1', refundId: 'x', amountPaise: 999999, source: 'webhook' });
    expect(Number(s.refundedAmount)).toBe(1099);
  });

  it('ignores a payment that is not a subscription payment', async () => {
    Subscription.findOne.mockResolvedValue(null);
    expect(await recordRefund({ paymentId: 'pay_other', refundId: 'r', amountPaise: 100, source: 'webhook' })).toEqual({ matched: false });
  });

  it('keeps the boost when another live unlimited plan remains', async () => {
    Subscription.count.mockResolvedValue(1);
    Subscription.findOne.mockResolvedValue(sub({ planType: 'vip' }));
    await recordRefund({ paymentId: 'pay_1', refundId: 'r', amountPaise: 109900, source: 'webhook' });
    expect(User.update).not.toHaveBeenCalled();
  });
});

describe('recordDispute', () => {
  it('flags an open dispute without taking access away', async () => {
    const s = sub();
    Subscription.findOne.mockResolvedValue(s);
    await recordDispute({ paymentId: 'pay_1', disputeId: 'd1', status: 'open' });
    expect(s.disputeStatus).toBe('open');
    expect(s.status).toBe('active');
  });

  it('a lost dispute ends the plan like a full refund', async () => {
    const s = sub();
    Subscription.findOne.mockResolvedValue(s);
    await recordDispute({ paymentId: 'pay_1', disputeId: 'd1', status: 'lost' });
    expect(s.status).toBe('cancelled');
    expect(Number(s.refundedAmount)).toBe(1099);
  });

  it('a won dispute is recorded and changes nothing else', async () => {
    const s = sub({ disputeStatus: 'open' });
    Subscription.findOne.mockResolvedValue(s);
    await recordDispute({ paymentId: 'pay_1', disputeId: 'd1', status: 'won' });
    expect(s.disputeStatus).toBe('won');
    expect(s.status).toBe('active');
  });
});

describe('invoiceBlocker', () => {
  it('issues a receipt only for a payment that was taken and not refunded in full', () => {
    expect(invoiceBlocker({ amount: '1099', razorpayPaymentId: 'pay_1', refundedAmount: '0' })).toBeNull();
    expect(invoiceBlocker({ amount: '1099', razorpayPaymentId: 'pay_1', refundedAmount: '300' })).toBeNull();
  });

  it('refuses a granted plan (list price, no payment reference)', () => {
    expect(invoiceBlocker({ amount: '1099', razorpayPaymentId: null, status: 'active' })).toMatch(/no payment was taken/i);
  });

  it('refuses a closed checkout', () => {
    expect(invoiceBlocker({ amount: '1099', razorpayPaymentId: null, status: 'cancelled' })).toMatch(/no payment was taken/i);
  });

  it('refuses a free row and a fully refunded payment', () => {
    expect(invoiceBlocker({ amount: '0', razorpayPaymentId: 'x' })).toMatch(/free or granted/i);
    expect(invoiceBlocker({ amount: '1099', razorpayPaymentId: 'pay_1', refundedAmount: '1099' })).toMatch(/refunded in full/i);
  });
});
