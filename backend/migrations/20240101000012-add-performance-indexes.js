'use strict';

/**
 * Migration: Add Performance Indexes
 * 
 * Adds indexes for frequently queried fields to improve query performance
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ==================== VERIFICATIONS TABLE ====================
    // Index for admin queries filtering by status
    await queryInterface.addIndex('Verifications', ['status'], {
      name: 'idx_verifications_status'
    });

    // Index for user lookups
    await queryInterface.addIndex('Verifications', ['userId'], {
      name: 'idx_verifications_user_id'
    });

    // Composite index for admin dashboard queries
    await queryInterface.addIndex('Verifications', ['status', 'createdAt'], {
      name: 'idx_verifications_status_created'
    });

    // ==================== PROFILE_VIEWS TABLE ====================
    // Composite index for efficient duplicate view checks
    await queryInterface.addIndex('ProfileViews', ['viewerId', 'viewedUserId'], {
      unique: true,
      name: 'idx_profile_views_viewer_viewed_unique'
    });

    // Index for views received queries
    await queryInterface.addIndex('ProfileViews', ['viewedUserId', 'createdAt'], {
      name: 'idx_profile_views_viewed_created'
    });

    // ==================== SUBSCRIPTIONS TABLE ====================
    // Composite index for active subscription checks
    await queryInterface.addIndex('Subscriptions', ['userId', 'status', 'endDate'], {
      name: 'idx_subscriptions_user_status_end'
    });

    // Index for Razorpay order lookups
    await queryInterface.addIndex('Subscriptions', ['razorpayOrderId'], {
      name: 'idx_subscriptions_razorpay_order'
    });

    // Index for payment ID lookups (idempotency checks)
    await queryInterface.addIndex('Subscriptions', ['razorpayPaymentId'], {
      name: 'idx_subscriptions_razorpay_payment'
    });

    // ==================== MATCHES TABLE ====================
    // Composite index for mutual match queries
    await queryInterface.addIndex('Matches', ['userId', 'matchedUserId', 'isMutual'], {
      name: 'idx_matches_user_matched_mutual'
    });

    // Index for likes received (column is "action" in Matches table)
    await queryInterface.addIndex('Matches', ['matchedUserId', 'action'], {
      name: 'idx_matches_matched_action'
    });

    // ==================== MESSAGES TABLE ====================
    // Composite index for conversation queries
    await queryInterface.addIndex('Messages', ['senderId', 'receiverId', 'createdAt'], {
      name: 'idx_messages_sender_receiver_created'
    });

    // Index for unread messages
    await queryInterface.addIndex('Messages', ['receiverId', 'isRead'], {
      name: 'idx_messages_receiver_read'
    });

    // ==================== PROFILES TABLE ====================
    // Index for search queries
    await queryInterface.addIndex('Profiles', ['gender'], {
      name: 'idx_profiles_gender'
    });

    // Composite index for location-based searches
    await queryInterface.addIndex('Profiles', ['city', 'state'], {
      name: 'idx_profiles_city_state'
    });

    // Index for completion percentage sorting
    await queryInterface.addIndex('Profiles', ['completionPercentage'], {
      name: 'idx_profiles_completion'
    });

    // ==================== USERS TABLE ====================
    // Index for phone lookups (if used)
    await queryInterface.addIndex('Users', ['phone'], {
      name: 'idx_users_phone'
    });

    // Index for status filtering
    await queryInterface.addIndex('Users', ['status'], {
      name: 'idx_users_status'
    });

    // Composite index for admin user queries
    await queryInterface.addIndex('Users', ['role', 'status', 'createdAt'], {
      name: 'idx_users_role_status_created'
    });
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
