'use strict';

/**
 * D1 — free-reply window (ChatGrants).
 *
 * A grant is created when a PREMIUM member sends the first message to a FREE
 * member (chatController.sendMessage). It authorizes the FREE side only
 * (ES2 — the premium side always re-derives from its live subscription):
 *  - READ forever: an existing grant lets the free member open and read the
 *    thread even after the window ends.
 *  - SEND while active: messagesUsed < FREE_REPLY_MAX_MESSAGES and
 *    now < firstReplyAt + FREE_REPLY_WINDOW_MS (window starts at first reply).
 *
 * Counters never reset in v1 (non-renewing by design). Enforcement is
 * transactional with a row lock in sendMessage, which is why messagesUsed
 * lives here and not in Redis.
 *
 * FKs are ON DELETE CASCADE (ES9): account deletion hard-deletes User rows and
 * an orphan grant would poison the conversations batch query.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ChatGrants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      premiumUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      freeUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      messagesUsed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      firstReplyAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // One grant per pair; IF NOT EXISTS keeps a partial re-run idempotent
    // (precedent 000044/000048).
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "chat_grants_pair" ON "ChatGrants" ("premiumUserId", "freeUserId");'
    );
    // Conversations batch lookup: all grants held by a free member.
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "chat_grants_free_user" ON "ChatGrants" ("freeUserId");'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ChatGrants');
  },
};
