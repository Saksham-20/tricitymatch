/**
 * Payment-history arithmetic, kept out of the page so it can be tested.
 *
 * Only a row carrying a payment reference is money the member actually paid
 * (`razorpayPaymentId` is also the Google Play purchase token). An admin grant
 * or a founding grant is stored with a list price or 0 and NO payment id, so
 * summing every `amount` reported comped plans as spend. Refunds are netted.
 */
export const isPaidRow = (s) => Boolean(s && s.razorpayPaymentId) && Number(s.amount) > 0;

export const refundedOf = (s) => Math.min(Number(s?.refundedAmount) || 0, Number(s?.amount) || 0);

export function summarisePayments(subscriptions = []) {
  let paid = 0;
  let refunded = 0;
  subscriptions.forEach((s) => {
    if (!isPaidRow(s)) return;
    paid += Number(s.amount) || 0;
    refunded += refundedOf(s);
  });
  return { totalPaid: paid, totalRefunded: refunded, totalSpent: Math.max(0, paid - refunded) };
}
