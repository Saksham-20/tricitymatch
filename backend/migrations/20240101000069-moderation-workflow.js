'use strict';

// Moderation workflow (audit P0-15):
//   Reports.priority/assignedTo/escalatedAt — high-risk reports (threats, underage,
//     financial scam) are 'urgent', surfaced first and mailed to staff at once.
//   EvidenceArchives — what the Terms promise ("we keep moderation records"): the
//     conversation and profile text behind a report survive the reported member
//     erasing their account, for 180 days, then are purged.
//   Appeals — a suspended member cannot sign in, so the appeal is public and
//     keyed by email; staff decide it and an overturn reactivates the account.
module.exports = {
  async up(queryInterface, Sequelize) {
    const reports = await queryInterface.describeTable('Reports');
    if (!reports.priority) {
      await queryInterface.addColumn('Reports', 'priority', { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'normal' });
    }
    if (!reports.assignedTo) {
      await queryInterface.addColumn('Reports', 'assignedTo', {
        type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      });
    }
    if (!reports.escalatedAt) await queryInterface.addColumn('Reports', 'escalatedAt', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "reports_priority_status_created" ON "Reports" ("priority", "status", "createdAt")'
    );

    await queryInterface.createTable('EvidenceArchives', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // Deliberately no foreign keys: the whole point is to outlive the user row.
      subjectUserId: { type: Sequelize.UUID, allowNull: false },
      reportId: { type: Sequelize.UUID, allowNull: true },
      reason: { type: Sequelize.STRING(40), allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false },
      preserveUntil: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "evidence_subject" ON "EvidenceArchives" ("subjectUserId")');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "evidence_preserve_until" ON "EvidenceArchives" ("preserveUntil")');

    await queryInterface.createTable('Appeals', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      email: { type: Sequelize.STRING(255), allowNull: false },
      statement: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      decidedBy: { type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      decisionNote: { type: Sequelize.TEXT, allowNull: true },
      decidedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "appeals_status_created" ON "Appeals" ("status", "createdAt")');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Appeals');
    await queryInterface.dropTable('EvidenceArchives');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "reports_priority_status_created"');
    const reports = await queryInterface.describeTable('Reports');
    for (const col of ['escalatedAt', 'assignedTo', 'priority']) {
      if (reports[col]) await queryInterface.removeColumn('Reports', col);
    }
  },
};
