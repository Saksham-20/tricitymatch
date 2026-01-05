'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: false
      },
      dateOfBirth: {
        type: Sequelize.DATE,
        allowNull: false
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      weight: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Chandigarh'
      },
      state: {
        type: Sequelize.STRING,
        defaultValue: 'Punjab'
      },
      skinTone: {
        type: Sequelize.ENUM('fair', 'wheatish', 'dark'),
        allowNull: true
      },
      diet: {
        type: Sequelize.ENUM('vegetarian', 'non-vegetarian', 'vegan', 'jain'),
        allowNull: true
      },
      smoking: {
        type: Sequelize.ENUM('never', 'occasionally', 'regularly'),
        allowNull: true
      },
      drinking: {
        type: Sequelize.ENUM('never', 'occasionally', 'regularly'),
        allowNull: true
      },
      education: {
        type: Sequelize.STRING,
        allowNull: true
      },
      degree: {
        type: Sequelize.STRING,
        allowNull: true
      },
      profession: {
        type: Sequelize.STRING,
        allowNull: true
      },
      income: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      preferredAgeMin: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      preferredAgeMax: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      preferredHeightMin: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      preferredHeightMax: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      preferredEducation: {
        type: Sequelize.STRING,
        allowNull: true
      },
      preferredProfession: {
        type: Sequelize.STRING,
        allowNull: true
      },
      preferredCity: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: ['Chandigarh', 'Mohali', 'Panchkula']
      },
      personalityValues: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      familyPreferences: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      lifestylePreferences: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      photos: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      profilePhoto: {
        type: Sequelize.STRING,
        allowNull: true
      },
      completionPercentage: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      showPhone: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      showEmail: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Profiles');
  }
};

