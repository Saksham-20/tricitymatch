'use strict';

/**
 * Migration: Add Performance Indexes
 *
 * Adds indexes for frequently queried fields. Uses IF NOT EXISTS so re-run is safe.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const run = (sql) => sequelize.query(sql);

    // ==================== VERIFICATIONS TABLE ====================
    await run('CREATE INDEX IF NOT EXISTS idx_verifications_status ON "Verifications" (status);');
    await run('CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON "Verifications" ("userId");');
    await run('CREATE INDEX IF NOT EXISTS idx_verifications_status_created ON "Verifications" (status, "createdAt");');

    // ==================== PROFILE_VIEWS TABLE ====================
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_viewer_viewed_unique ON "ProfileViews" ("viewerId", "viewedUserId");');
    await run('CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_created ON "ProfileViews" ("viewedUserId", "createdAt");');

    // ==================== SUBSCRIPTIONS TABLE ====================
    await run('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_end ON "Subscriptions" ("userId", status, "endDate");');
    await run('CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order ON "Subscriptions" ("razorpayOrderId");');
    await run('CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment ON "Subscriptions" ("razorpayPaymentId");');

    // ==================== MATCHES TABLE ====================
    await run('CREATE INDEX IF NOT EXISTS idx_matches_user_matched_mutual ON "Matches" ("userId", "matchedUserId", "isMutual");');
    await run('CREATE INDEX IF NOT EXISTS idx_matches_matched_action ON "Matches" ("matchedUserId", "action");');

    // ==================== MESSAGES TABLE ====================
    await run('CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver_created ON "Messages" ("senderId", "receiverId", "createdAt");');
    await run('CREATE INDEX IF NOT EXISTS idx_messages_receiver_read ON "Messages" ("receiverId", "isRead");');

    // ==================== PROFILES TABLE ====================
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_gender ON "Profiles" (gender);');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_city_state ON "Profiles" (city, state);');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_completion ON "Profiles" ("completionPercentage");');

    // ==================== USERS TABLE ====================
    await run('CREATE INDEX IF NOT EXISTS idx_users_phone ON "Users" (phone);');
    await run('CREATE INDEX IF NOT EXISTS idx_users_status ON "Users" (status);');
    await run('CREATE INDEX IF NOT EXISTS idx_users_role_status_created ON "Users" (role, status, "createdAt");');
  },

  async down(queryInterface, Sequelize) {
    // Remove all indexes in reverse order
    await queryInterface.removeIndex('Users', 'idx_users_role_status_created');
    await queryInterface.removeIndex('Users', 'idx_users_status');
    await queryInterface.removeIndex('Users', 'idx_users_phone');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_completion');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_city_state');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_gender');
    await queryInterface.removeIndex('Messages', 'idx_messages_receiver_read');
    await queryInterface.removeIndex('Messages', 'idx_messages_sender_receiver_created');
    await queryInterface.removeIndex('Matches', 'idx_matches_matched_action');
    await queryInterface.removeIndex('Matches', 'idx_matches_user_matched_mutual');
    await queryInterface.removeIndex('Subscriptions', 'idx_subscriptions_razorpay_payment');
    await queryInterface.removeIndex('Subscriptions', 'idx_subscriptions_razorpay_order');
    await queryInterface.removeIndex('Subscriptions', 'idx_subscriptions_user_status_end');
    await queryInterface.removeIndex('ProfileViews', 'idx_profile_views_viewed_created');
    await queryInterface.removeIndex('ProfileViews', 'idx_profile_views_viewer_viewed_unique');
    await queryInterface.removeIndex('Verifications', 'idx_verifications_status_created');
    await queryInterface.removeIndex('Verifications', 'idx_verifications_user_id');
    await queryInterface.removeIndex('Verifications', 'idx_verifications_status');
  }
};
