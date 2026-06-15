'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SuccessStories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      coupleNames: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      marriedOn: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      quote: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      photoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      tag: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('SuccessStories', ['status', 'displayOrder']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SuccessStories');
    // Drop the ENUM type created by Postgres for the status column
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SuccessStories_status";');
  },
};
