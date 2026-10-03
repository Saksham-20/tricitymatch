'use strict';

/**
 * A contact number that is not the login number.
 *
 * `Users.phone` is the account's login identity (unique, used for phone login
 * and phone password reset). The number members call after an unlock used to be
 * the same column, so a parent who typed their own number as the contact number
 * silently rewired how the account signs in. `contactPhone` holds a verified
 * contact number that differs from the login number. Null means "the contact
 * number is the login number", so no backfill is needed.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('Users');
    if (!users.contactPhone) {
      await queryInterface.addColumn('Users', 'contactPhone', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const users = await queryInterface.describeTable('Users');
    if (users.contactPhone) await queryInterface.removeColumn('Users', 'contactPhone');
  },
};
