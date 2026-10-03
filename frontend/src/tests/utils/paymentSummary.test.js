import { describe, it, expect } from 'vitest';
import { summarisePayments, isPaidRow, refundedOf } from '../../utils/paymentSummary';

const row = (o) => ({ amount: 1100, razorpayPaymentId: 'pay_1', refundedAmount: 0, ...o });

describe('payment history arithmetic', () => {
  it('counts only rows with a payment reference (admin and founding grants are not spend)', () => {
    const { totalSpent } = summarisePayments([
      row({}),
      row({ razorpayPaymentId: null, amount: 1100 }), // admin grant at list price
      row({ razorpayPaymentId: null, amount: 0 }),    // founding grant
    ]);
    expect(totalSpent).toBe(1100);
  });

  it('nets partial refunds', () => {
    const r = summarisePayments([row({ refundedAmount: 400 })]);
    expect(r).toEqual({ totalPaid: 1100, totalRefunded: 400, totalSpent: 700 });
  });

  it('a fully refunded plan nets to zero and never goes negative', () => {
    expect(summarisePayments([row({ refundedAmount: 1100 })]).totalSpent).toBe(0);
    expect(refundedOf(row({ refundedAmount: 5000 }))).toBe(1100);
  });

  it('keeps a superseded (cancelled) paid row in the total', () => {
    const { totalSpent } = summarisePayments([row({ status: 'cancelled' }), row({ razorpayPaymentId: 'pay_2', amount: 2000 })]);
    expect(totalSpent).toBe(3100);
  });

  it('isPaidRow rejects a ₹0 row even with a payment id', () => {
    expect(isPaidRow(row({ amount: 0 }))).toBe(false);
  });
});
