'use strict';

/**
 * Security: enforce that a payment identifier settles exactly one thing.
 *
 * Two replay paths depended on application-level checks alone:
 *
 *  1. Subscriptions — Google Play idempotency was keyed on
 *     (userId, purchaseToken), so one real purchase token activated the tier on
 *     an unbounded number of accounts. `razorpayPaymentId` carried only a plain
 *     index, never a unique constraint.
 *
 *  2. AstrologerBookings — the verify handler never checked whether a payment
 *     id had already been used, so one genuine (order, payment, signature)
 *     triple could confirm every other pending booking.
 *
 * The controllers now check both, but a uniqueness constraint is the only thing
 * that holds under concurrency — two simultaneous requests can both pass a
 * SELECT and then both INSERT. Partial indexes (WHERE ... IS NOT NULL) so the
 * many legitimately-NULL rows are unaffected.
 *
 * Existing duplicates are surfaced rather than silently mangled: the migration
 * fails loudly and the rows must be reconciled by hand, because deciding which
 * account keeps a double-claimed purchase is a business call, not a mechanical
 * one.
 */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') return;

    const sequelize = queryInterface.sequelize;

    const assertNoDuplicates = async (table, column) => {
      const [rows] = await sequelize.query(
        `SELECT "${column}" AS value, COUNT(*) AS count
           FROM "${table}"
          WHERE "${column}" IS NOT NULL
          GROUP BY "${column}"
         HAVING COUNT(*) > 1`
      );
      if (rows.length > 0) {
        const sample = rows.slice(0, 5).map((r) => `${r.value} (x${r.count})`).join(', ');
        throw new Error(
          `Cannot add unique index: "${table}"."${column}" has ${rows.length} duplicated value(s). ` +
          `Reconcile these rows first — a duplicate here means one payment was credited more than once. ` +
          `Examples: ${sample}`
        );
      }
    };

    await assertNoDuplicates('Subscriptions', 'razorpayPaymentId');
    await assertNoDuplicates('AstrologerBookings', 'razorpayPaymentId');

    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpay_payment_id_unique"
         ON "Subscriptions" ("razorpayPaymentId")
         WHERE "razorpayPaymentId" IS NOT NULL`
    );

    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "astrologer_bookings_razorpay_payment_id_unique"
         ON "AstrologerBookings" ("razorpayPaymentId")
         WHERE "razorpayPaymentId" IS NOT NULL`
    );
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') return;

    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "subscriptions_razorpay_payment_id_unique"'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "astrologer_bookings_razorpay_payment_id_unique"'
    );
  },
};
