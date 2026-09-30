'use strict';

/**
 * Whether a Subscription may be turned into a receipt/invoice, and if not, why.
 *
 * A receipt says "Total Paid ₹X". The old check rejected only ₹0 rows and
 * `pending` orders with no payment, so it happily issued a "Payment Receipt"
 * for a checkout the member closed (`cancelled`, no payment) and for a plan an
 * admin granted (written at list price, no payment reference) — a fabricated
 * proof of payment usable for expense claims or a dispute. The rule is now the
 * one every revenue read already uses: a payment reference must exist.
 */

const invoiceBlocker = (subscription) => {
  const amount = Number(subscription.amount) || 0;
  if (amount === 0) return 'Invoice not available for a free or granted plan';
  if (!subscription.razorpayPaymentId) {
    return 'No payment was taken for this plan, so there is no invoice for it';
  }
  if (Number(subscription.refundedAmount || 0) >= amount) {
    return 'This payment was refunded in full, so there is no invoice for it';
  }
  return null;
};

module.exports = { invoiceBlocker };
