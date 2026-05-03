'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ReferralCodes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      marketingUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      campaign: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      source: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      usageCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('ReferralCodes', ['code'], {
      unique: true,
      name: 'referral_codes_code_unique'
    });

    await queryInterface.addIndex('ReferralCodes', ['marketingUserId'], {
      name: 'referral_codes_marketing_user_id'
    });

    await queryInterface.addIndex('ReferralCodes', ['isActive'], {
      name: 'referral_codes_is_active'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ReferralCodes');
  }
};
