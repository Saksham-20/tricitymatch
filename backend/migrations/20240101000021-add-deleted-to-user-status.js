'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      // PostgreSQL: add 'deleted' value to the existing enum type
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Users_status" ADD VALUE IF NOT EXISTS 'deleted';`
      );
    } else {
      // MySQL/SQLite: change column with new enum list
      await queryInterface.changeColumn('Users', 'status', {
        type: Sequelize.ENUM('active', 'inactive', 'banned', 'pending', 'deleted'),
        defaultValue: 'pending',
        allowNull: false,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Postgres: removing an enum value requires recreating the type — skip for safety
    // MySQL/SQLite: restore original enum
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') {
      await queryInterface.changeColumn('Users', 'status', {
        type: Sequelize.ENUM('active', 'inactive', 'banned', 'pending'),
        defaultValue: 'pending',
        allowNull: false,
      });
    }
  },
};
