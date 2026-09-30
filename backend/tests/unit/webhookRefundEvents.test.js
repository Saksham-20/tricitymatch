/**
 * The webhook used to handle exactly payment.captured and payment.failed; a
 * refund or chargeback raised anywhere left the member premium and the money
 * counted as revenue (audit P0-12).
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'k', keyId: 'rzp_test_x', webhookSecret: 'h', isConfigured: () => true },
  founding: { endsAt: '', memberCap: 0, isOpen: jest.fn(() => false) },
  isProduction: false, isDevelopment: true,
}));
jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn(), update: jest.fn() },
  User: { update: jest.fn(), findByPk: jest.fn() },
  Profile: {}, MarketingLead: {}, UnlockPurchase: { findOne: jest.fn() },
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn(async (fn) => fn('TX')) }));
jest.mock('../../utils/email', () => ({ sendSubscriptionConfirmation: jest.fn() }));
jest.mock('../../utils/invoice', () => ({ generateInvoicePDF: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
const mockRefund = jest.fn().mockResolvedValue({ matched: true });
const mockDispute = jest.fn().mockResolvedValue({ matched: true });
jest.mock('../../utils/paymentRefunds', () => ({ recordRefund: (...a) => mockRefund(...a), recordDispute: (...a) => mockDispute(...a) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { webhook } = require('../../controllers/subscriptionController');

const fire = async (body) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  webhook({ body }, res, next);
  await new Promise((r) => setImmediate(r));
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('refund and dispute webhook events', () => {
  it('refund.processed records the refund against the payment', async () => {
    const res = await fire({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 109900 } } } });
    expect(mockRefund).toHaveBeenCalledWith({ paymentId: 'pay_1', refundId: 'rfnd_1', amountPaise: 109900, source: 'webhook' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('a lost dispute is passed through with its status', async () => {
    await fire({ event: 'payment.dispute.lost', payload: { dispute: { entity: { id: 'disp_1', payment_id: 'pay_1', status: 'lost' } } } });
    expect(mockDispute).toHaveBeenCalledWith({ paymentId: 'pay_1', disputeId: 'disp_1', status: 'lost' });
  });

  it('falls back to the event name when the dispute entity carries no status', async () => {
    await fire({ event: 'payment.dispute.won', payload: { dispute: { entity: { id: 'disp_2', payment_id: 'pay_2' } } } });
    expect(mockDispute).toHaveBeenCalledWith(expect.objectContaining({ status: 'won' }));
  });

  it('acknowledges a refund event with no entity instead of failing (Razorpay would retry forever)', async () => {
    const res = await fire({ event: 'refund.processed', payload: {} });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(mockRefund).not.toHaveBeenCalled();
  });
});
