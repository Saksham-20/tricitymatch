'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MarketingLeads', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      source: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      campaign: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      referralCode: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      assignedToMarketingUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('new', 'contacted', 'converted', 'lost'),
        allowNull: false,
        defaultValue: 'new'
      },
      paymentStatus: {
        type: Sequelize.ENUM('none', 'paid'),
        allowNull: false,
        defaultValue: 'none'
      },
      amountPaid: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      paymentId: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      convertedUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('MarketingLeads', ['assignedToMarketingUserId', 'status'], {
      name: 'marketing_leads_assigned_user_status'
    });

    await queryInterface.addIndex('MarketingLeads', ['phone'], {
      name: 'marketing_leads_phone'
    });

    await queryInterface.addIndex('MarketingLeads', ['status'], {
      name: 'marketing_leads_status'
    });

    await queryInterface.addIndex('MarketingLeads', ['referralCode'], {
      name: 'marketing_leads_referral_code'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MarketingLeads');
    // Drop ENUMs (PostgreSQL)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MarketingLeads_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MarketingLeads_paymentStatus";');
  }
};
