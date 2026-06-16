/**
 * Razorpay signature-verification unit tests (UTIL-1).
 * Locks in the timing-safe HMAC compare + length guard.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'test_secret_key', keyId: 'rzp_test_xxx' },
}));

const crypto = require('crypto');
const { verifyPayment } = require('../../utils/razorpay');

const sign = (orderId, paymentId, secret = 'test_secret_key') =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

describe('razorpay.verifyPayment', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  it('accepts a correctly-signed payment', () => {
    expect(verifyPayment(orderId, paymentId, sign(orderId, paymentId))).toBe(true);
  });

  it('rejects a tampered signature of the same length', () => {
    const good = sign(orderId, paymentId);
    const bad = good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a');
    expect(verifyPayment(orderId, paymentId, bad)).toBe(false);
  });

  it('rejects a wrong-length signature without throwing (length guard)', () => {
    expect(() => verifyPayment(orderId, paymentId, 'deadbeef')).not.toThrow();
    expect(verifyPayment(orderId, paymentId, 'deadbeef')).toBe(false);
  });

  it('rejects a non-string signature without throwing', () => {
    expect(() => verifyPayment(orderId, paymentId, undefined)).not.toThrow();
    expect(verifyPayment(orderId, paymentId, undefined)).toBe(false);
  });

  it('rejects a signature created with a different secret', () => {
    expect(verifyPayment(orderId, paymentId, sign(orderId, paymentId, 'other'))).toBe(false);
  });
});
