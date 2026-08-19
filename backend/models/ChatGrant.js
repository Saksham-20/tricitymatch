const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * D1 free-reply window. One row per (premium, free) pair — created server-side
 * only, by chatController.sendMessage when a paid member first messages a free
 * member. Authorizes the FREE side only (ES2): the premium side must always
 * re-derive access from its live subscription, never from a grant's existence.
 *
 * Read semantics: grant existing = free member may READ the thread forever.
 * Send semantics: enforced transactionally with a row lock in sendMessage —
 * messagesUsed < FREE_REPLY_MAX_MESSAGES and inside the window that starts at
 * firstReplyAt. Counters never reset (non-renewing v1).
 */
const ChatGrant = sequelize.define('ChatGrant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  premiumUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  freeUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  messagesUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  firstReplyAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    { unique: true, fields: ['premiumUserId', 'freeUserId'] },
    { fields: ['freeUserId'] }
  ]
});

module.exports = ChatGrant;
