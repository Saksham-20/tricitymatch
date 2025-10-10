'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Preferences', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ageMin: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      ageMax: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      heightMin: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      heightMax: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      religion: {
        type: Sequelize.STRING,
        allowNull: true
      },
      caste: {
        type: Sequelize.STRING,
        allowNull: true
      },
      education: {
        type: Sequelize.STRING,
        allowNull: true
      },
      profession: {
        type: Sequelize.STRING,
        allowNull: true
      },
      incomeMin: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      incomeMax: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true
      },
      diet: {
        type: Sequelize.ENUM('vegetarian', 'non-vegetarian', 'vegan', 'jain', 'any'),
        allowNull: true
      },
      smoking: {
        type: Sequelize.ENUM('yes', 'no', 'occasionally', 'any'),
        allowNull: true
      },
      drinking: {
        type: Sequelize.ENUM('yes', 'no', 'occasionally', 'any'),
        allowNull: true
      },
      kundliMatch: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('Preferences', ['userId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Preferences');
  }
};
