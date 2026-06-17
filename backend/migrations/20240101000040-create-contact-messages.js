'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ContactMessages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('new', 'read', 'resolved'),
        allowNull: false,
        defaultValue: 'new',
      },
      ipAddress: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Idempotent: a prior partial run / model sync may have created this already.
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "contact_messages_status_created_at" ON "ContactMessages" ("status", "createdAt");'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ContactMessages');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ContactMessages_status";');
  },
};
