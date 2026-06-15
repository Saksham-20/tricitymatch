'use strict';

/**
 * Migration: Add ProfileView viewer index
 *
 * Recently-viewed query (GET /profile/me/recently-viewed) filters by viewerId
 * and orders by createdAt DESC. ProfileView already has (viewedUserId, createdAt);
 * this adds the symmetric (viewerId, createdAt) index for scale.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_profileviews_viewer_created ON "ProfileViews" ("viewerId", "createdAt" DESC);'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ProfileViews', 'idx_profileviews_viewer_created');
  }
};
