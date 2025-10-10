'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Profiles', {
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
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: false
      },
      dob: {
        type: Sequelize.DATEONLY,
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
      religion: {
        type: Sequelize.STRING,
        allowNull: true
      },
      caste: {
        type: Sequelize.STRING,
        allowNull: true
      },
      community: {
        type: Sequelize.STRING,
        allowNull: true
      },
      skinTone: {
        type: Sequelize.ENUM('fair', 'wheatish', 'dark', 'very fair'),
        allowNull: true
      },
      diet: {
        type: Sequelize.ENUM('vegetarian', 'non-vegetarian', 'vegan', 'jain'),
        allowNull: true
      },
      smoking: {
        type: Sequelize.ENUM('yes', 'no', 'occasionally'),
        allowNull: true
      },
      drinking: {
        type: Sequelize.ENUM('yes', 'no', 'occasionally'),
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
      income: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      photos: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: false
      },
      personalityAnswers: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false
      },
      verificationStatus: {
        type: Sequelize.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
      },
      verificationDocs: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false
      },
      verificationNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      birthTime: {
        type: Sequelize.TIME,
        allowNull: true
      },
      birthPlace: {
        type: Sequelize.STRING,
        allowNull: true
      },
      kundliData: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false
      },
      isProfileComplete: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      profileCompletionPercentage: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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
    await queryInterface.addIndex('Profiles', ['userId']);
    await queryInterface.addIndex('Profiles', ['gender']);
    await queryInterface.addIndex('Profiles', ['religion']);
    await queryInterface.addIndex('Profiles', ['caste']);
    await queryInterface.addIndex('Profiles', ['city']);
    await queryInterface.addIndex('Profiles', ['verificationStatus']);
    await queryInterface.addIndex('Profiles', ['isProfileComplete']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Profiles');
  }
};
