'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Reports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      reporterId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      reportedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      reason: {
        type: Sequelize.ENUM(
          'fake_profile',
          'harassment',
          'spam',
          'inappropriate_content',
          'underage',
          'other'
        ),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'reviewed', 'dismissed'),
        defaultValue: 'pending',
      },
      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      reviewedAt: {
        type: Sequelize.DATE,
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

    const run17 = (sql) => queryInterface.sequelize.query(sql);
    await run17('CREATE INDEX IF NOT EXISTS "reports_reported_user_id_status" ON "Reports" ("reportedUserId", status)');
    await run17('CREATE INDEX IF NOT EXISTS "reports_reporter_id" ON "Reports" ("reporterId")');
    await run17('CREATE INDEX IF NOT EXISTS "reports_status" ON "Reports" (status)');
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('Reports');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Reports_reason"; DROP TYPE IF EXISTS "enum_Reports_status";'
    );
  },
};
