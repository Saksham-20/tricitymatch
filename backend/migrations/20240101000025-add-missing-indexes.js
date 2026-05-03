'use strict';

module.exports = {
  async up(queryInterface) {
    // Messages: composite for conversation pagination (not in any prior migration)
    await queryInterface.addIndex('Messages', ['senderId', 'receiverId', 'createdAt'], {
      name: 'messages_sender_receiver_created_at',
      using: 'BTREE'
    });

    // Verifications: index on verifiedBy for admin lookup queries
    await queryInterface.addIndex('Verifications', ['verifiedBy'], {
      name: 'verifications_verified_by'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Messages', 'messages_sender_receiver_created_at');
    await queryInterface.removeIndex('Verifications', 'verifications_verified_by');
  }
};
