/**
 * A member who paid but whose browser and webhook both failed holds nothing
 * until support notices (audit P0-12). The reconciler asks Razorpay directly.
 */

jest.mock('../../models', () => ({ Subscription: { findAll: jest.fn() } }));
const mockActivate = jest.fn().mockResolvedValue(undefined);
jest.mock('../../utils/subscriptionActivation', () => ({ activateCapturedPayment: (...a) => mockActivate(...a) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { Subscription } = require('../../models');
const { reconcilePendingOrders } = require('../../utils/paymentReconcile');

const row = (id, order) => ({ id, userId: `u-${id}`, razorpayOrderId: order });
const gatewayWith = (byOrder) => ({ orders: { fetchPayments: jest.fn(async (o) => ({ items: byOrder[o] || [] })) } });

beforeEach(() => jest.clearAllMocks());

describe('reconcilePendingOrders', () => {
  it('activates an order Razorpay says was captured, and leaves unpaid ones alone', async () => {
    Subscription.findAll.mockResolvedValue([row('a', 'order_a'), row('b', 'order_b')]);
    const gateway = gatewayWith({
      order_a: [{ id: 'pay_failed', status: 'failed' }, { id: 'pay_ok', status: 'captured' }],
      order_b: [{ id: 'pay_x', status: 'failed' }],
    });
    const out = await reconcilePendingOrders({ gateway });
    expect(out).toEqual({ checked: 2, activated: 1 });
    expect(mockActivate).toHaveBeenCalledTimes(1);
    expect(mockActivate).toHaveBeenCalledWith('order_a', 'pay_ok');
  });

  it('one failing order does not stop the rest', async () => {
    Subscription.findAll.mockResolvedValue([row('a', 'order_a'), row('b', 'order_b')]);
    const gateway = { orders: { fetchPayments: jest.fn()
      .mockRejectedValueOnce(new Error('gateway timeout'))
      .mockResolvedValueOnce({ items: [{ id: 'pay_ok', status: 'captured' }] }) } };
    const out = await reconcilePendingOrders({ gateway });
    expect(out.activated).toBe(1);
    expect(mockActivate).toHaveBeenCalledWith('order_b', 'pay_ok');
  });

  it('only asks about orders old enough to be abandoned and young enough to matter', async () => {
    Subscription.findAll.mockResolvedValue([]);
    const now = new Date('2026-09-29T12:00:00Z');
    await reconcilePendingOrders({ gateway: gatewayWith({}), now });
    const { where, limit } = Subscription.findAll.mock.calls[0][0];
    expect(limit).toBeLessThanOrEqual(50);
    const [from, to] = where.createdAt[Object.getOwnPropertySymbols(where.createdAt)[0]];
    expect(to.getTime()).toBe(now.getTime() - 15 * 60 * 1000);
    expect(from.getTime()).toBe(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(where.razorpayPaymentId).toBeNull();
  });

  it('does nothing when the gateway is not configured', async () => {
    const out = await reconcilePendingOrders({ gateway: {} });
    expect(out).toMatchObject({ checked: 0, activated: 0 });
    expect(Subscription.findAll).not.toHaveBeenCalled();
  });
});
