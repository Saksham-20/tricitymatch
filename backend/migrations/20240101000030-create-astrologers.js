'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Astrologers', {
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
      speciality: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
      },
      experience: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      rating: {
        type: Sequelize.DECIMAL(3, 1),
        defaultValue: 0,
      },
      reviewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      pricePerMin: {
        type: Sequelize.INTEGER, // in INR
        allowNull: false,
        defaultValue: 20,
      },
      languages: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
      },
      avatarUrl: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isOnline: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    await queryInterface.addIndex('Astrologers', ['isOnline', 'isActive']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Astrologers');
  },
};
