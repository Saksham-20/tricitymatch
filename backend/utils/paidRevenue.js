'use strict';

/**
 * What counts as money taken — ONE definition for every revenue and commission
 * read (admin dashboard, revenue page, marketing report, rep dashboard).
 *
 * A Subscription row counts when a payment reference exists (an admin grant is
 * written with the plan's list price and no payment id; `razorpayPaymentId`
 * also carries the Google Play purchase token, so store purchases count) and it
 * has NOT been fully refunded or lost to a dispute (`refundedAt` is stamped by
 * `utils/paymentRefunds.js endPlan` on exactly those two events).
 *
 * Deliberately NOT keyed on `status`. A paid row routinely ends up
 * `cancelled`/`expired` without the money going anywhere: the old plan is
 * superseded when the member upgrades, the member cancels (policy: the term is
 * not refunded), an admin overrides or cancels the plan. Keying on status made
 * the first payment of an upgrade vanish from revenue and commission.
 *
 * A PARTIAL refund keeps the row and only nets the amount (`netPaid`).
 */

const { Op } = require('sequelize');

const PAID_SUBSCRIPTION_WHERE = {
  razorpayPaymentId: { [Op.ne]: null },
  refundedAt: null,
};

/** The same predicate for raw SQL over the Subscriptions table. */
const PAID_SUBSCRIPTION_SQL = `"razorpayPaymentId" IS NOT NULL AND "refundedAt" IS NULL`;

const money = (v) => (v == null ? 0 : Number(v));

/** What a paid subscription actually kept: amount less partial refunds, never negative. */
const netPaid = (sub) => Math.max(0, money(sub.amount) - money(sub.refundedAmount));

module.exports = { PAID_SUBSCRIPTION_WHERE, PAID_SUBSCRIPTION_SQL, netPaid, money };
