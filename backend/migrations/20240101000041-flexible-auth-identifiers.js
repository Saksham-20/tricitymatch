'use strict';

// Flexible auth: allow signup/login with EITHER email OR phone.
// - email becomes nullable (phone-only accounts have no email)
// - phone gets a partial-unique index (unambiguous phone login; nulls allowed)
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) email nullable (was NOT NULL)
    await queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // 2) partial-unique index on phone (only enforced where phone IS NOT NULL,
    //    so existing null-phone rows are unaffected and multiple nulls are fine)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_unique" ON "Users" ("phone") WHERE "phone" IS NOT NULL;'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "users_phone_unique";');
    // Note: reverting email to NOT NULL would fail if any phone-only rows exist;
    // leave it nullable on down to avoid a destructive failure.
    await queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
