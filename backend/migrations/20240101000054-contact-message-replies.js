'use strict';

/**
 * Admin replies on support enquiries.
 *
 * The contact form stored the enquiry and fired a best-effort email to
 * SUPPORT_EMAIL, but support had no way to ANSWER from inside the product —
 * the only reply path was whatever mailbox that address happened to land in.
 * These columns record the reply that was sent, so the thread is auditable and
 * a second admin can see the enquiry was already handled.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ContactMessages');

    if (!table.replyBody) {
      await queryInterface.addColumn('ContactMessages', 'replyBody', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!table.repliedAt) {
      await queryInterface.addColumn('ContactMessages', 'repliedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.repliedBy) {
      // Not a FK: a deleted admin account must not cascade away the support record.
      await queryInterface.addColumn('ContactMessages', 'repliedBy', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ContactMessages', 'replyBody');
    await queryInterface.removeColumn('ContactMessages', 'repliedAt');
    await queryInterface.removeColumn('ContactMessages', 'repliedBy');
  },
};
