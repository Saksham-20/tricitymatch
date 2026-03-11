'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RefreshTokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      token: {
        type: Sequelize.STRING(512),
        allowNull: false
      },
      tokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      family: {
        type: Sequelize.UUID,
        allowNull: false
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      isRevoked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      revokedReason: {
        type: Sequelize.STRING,
        allowNull: true
      },
      userAgent: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes — use raw SQL so re-running is safe if indexes already exist
    const qi = queryInterface.sequelize;
    await qi.query('CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id" ON "RefreshTokens" ("userId")');
    await qi.query('CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash" ON "RefreshTokens" ("tokenHash")');
    await qi.query('CREATE INDEX IF NOT EXISTS "refresh_tokens_family" ON "RefreshTokens" ("family")');
    await qi.query('CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at" ON "RefreshTokens" ("expiresAt")');
    await qi.query('CREATE INDEX IF NOT EXISTS "refresh_tokens_is_revoked" ON "RefreshTokens" ("isRevoked")');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('RefreshTokens');
  }
};
