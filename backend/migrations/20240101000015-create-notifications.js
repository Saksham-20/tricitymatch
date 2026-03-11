'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM(
          'new_match',
          'new_message',
          'verification_approved',
          'verification_rejected',
          'subscription_expiring',
          'profile_view',
          'report_reviewed',
          'system'
        ),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      relatedId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    const run15 = (sql) => queryInterface.sequelize.query(sql);
    await run15('CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read" ON "Notifications" ("userId", "isRead")');
    await run15('CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at" ON "Notifications" ("userId", "createdAt")');
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('Notifications');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Notifications_type";'
    );
  },
};
