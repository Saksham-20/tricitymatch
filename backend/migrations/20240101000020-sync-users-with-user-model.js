'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'phoneVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('Users', 'referralCodeUsed', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('Users', 'referredByMarketingUserId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('Users', 'isBoosted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('Users', 'boostExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Users_role\" ADD VALUE IF NOT EXISTS 'super_admin'"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Users_role\" ADD VALUE IF NOT EXISTS 'marketing_manager'"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Users_role\" ADD VALUE IF NOT EXISTS 'marketing'"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'boostExpiresAt');
    await queryInterface.removeColumn('Users', 'isBoosted');
    await queryInterface.removeColumn('Users', 'referredByMarketingUserId');
    await queryInterface.removeColumn('Users', 'referralCodeUsed');
    await queryInterface.removeColumn('Users', 'phoneVerified');
  }
};