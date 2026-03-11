'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add contact unlock tracking columns to Subscriptions
    await queryInterface.addColumn('Subscriptions', 'contactUnlocksAllowed', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Max contact unlocks allowed for this plan. NULL = unlimited.'
    });

    await queryInterface.addColumn('Subscriptions', 'contactUnlocksUsed', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of contact unlocks used so far.'
    });

    // 2. Alter planType ENUM to include new plan names
    //    MySQL approach: ALTER COLUMN directly
    //    PostgreSQL approach: Create new enum type, alter column, drop old type
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'mysql' || dialect === 'mariadb') {
      await queryInterface.sequelize.query(
        "ALTER TABLE `Subscriptions` MODIFY COLUMN `planType` ENUM('free', 'premium', 'elite', 'basic_premium', 'premium_plus', 'vip') DEFAULT 'free'"
      );
      // Migrate existing data
      await queryInterface.sequelize.query(
        "UPDATE `Subscriptions` SET `planType` = 'basic_premium' WHERE `planType` = 'premium'"
      );
      await queryInterface.sequelize.query(
        "UPDATE `Subscriptions` SET `planType` = 'premium_plus' WHERE `planType` = 'elite'"
      );
      // Remove old enum values
      await queryInterface.sequelize.query(
        "ALTER TABLE `Subscriptions` MODIFY COLUMN `planType` ENUM('free', 'basic_premium', 'premium_plus', 'vip') DEFAULT 'free'"
      );
    } else if (dialect === 'postgres') {
      // PostgreSQL: create new type, alter column, drop old
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Subscriptions_planType\" ADD VALUE IF NOT EXISTS 'basic_premium'"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Subscriptions_planType\" ADD VALUE IF NOT EXISTS 'premium_plus'"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Subscriptions_planType\" ADD VALUE IF NOT EXISTS 'vip'"
      );
      // Migrate existing data
      await queryInterface.sequelize.query(
        "UPDATE \"Subscriptions\" SET \"planType\" = 'basic_premium' WHERE \"planType\" = 'premium'"
      );
      await queryInterface.sequelize.query(
        "UPDATE \"Subscriptions\" SET \"planType\" = 'premium_plus' WHERE \"planType\" = 'elite'"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'mysql' || dialect === 'mariadb') {
      // Revert plan names
      await queryInterface.sequelize.query(
        "ALTER TABLE `Subscriptions` MODIFY COLUMN `planType` ENUM('free', 'premium', 'elite', 'basic_premium', 'premium_plus', 'vip') DEFAULT 'free'"
      );
      await queryInterface.sequelize.query(
        "UPDATE `Subscriptions` SET `planType` = 'premium' WHERE `planType` = 'basic_premium'"
      );
      await queryInterface.sequelize.query(
        "UPDATE `Subscriptions` SET `planType` = 'elite' WHERE `planType` = 'premium_plus'"
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE `Subscriptions` MODIFY COLUMN `planType` ENUM('free', 'premium', 'elite') DEFAULT 'free'"
      );
    } else if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "UPDATE \"Subscriptions\" SET \"planType\" = 'premium' WHERE \"planType\" = 'basic_premium'"
      );
      await queryInterface.sequelize.query(
        "UPDATE \"Subscriptions\" SET \"planType\" = 'elite' WHERE \"planType\" = 'premium_plus'"
      );
    }

    await queryInterface.removeColumn('Subscriptions', 'contactUnlocksUsed');
    await queryInterface.removeColumn('Subscriptions', 'contactUnlocksAllowed');
  }
};
