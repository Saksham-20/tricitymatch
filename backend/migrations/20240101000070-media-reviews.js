'use strict';

// Image moderation queue (audit P1-6). One row per photo a human must look at:
//   source 'auto'   -> the screening provider flagged an upload; the photo is HELD
//                      (kept off the member's profile) until a reviewer decides.
//   source 'report' -> a stolen-photo report; the photo stays live until decided.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MediaReviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      url: { type: Sequelize.TEXT, allowNull: false },
      source: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'auto' },
      status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'pending' },
      provider: { type: Sequelize.STRING(40), allowNull: true },
      labels: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      wasProfilePhoto: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reportId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Reports', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      decidedBy: { type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      decisionNote: { type: Sequelize.TEXT, allowNull: true },
      decidedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "media_reviews_status_created" ON "MediaReviews" ("status", "createdAt")');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "media_reviews_user" ON "MediaReviews" ("userId")');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MediaReviews');
  },
};
