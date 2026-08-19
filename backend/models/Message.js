const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    // D2: length rules apply to TEXT messages only — a voice message stores ''
    // (the bubble renders from mediaUrl). Conditional validator instead of the
    // static len rule so voice rows don't fail notEmpty.
    validate: {
      textContentLength(value) {
        if ((this.messageType || 'text') !== 'text') return;
        if (typeof value !== 'string' || value.length < 1 || value.length > 2000) {
          throw new Error('Message content must be 1-2000 characters');
        }
      }
    }
  },
  messageType: {
    type: DataTypes.ENUM('text', 'voice'),
    allowNull: false,
    defaultValue: 'text'
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mediaDurationMs: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  replyToId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Messages',
      key: 'id'
    }
  },
  // { "❤️": [userId, …] } — allowlist in constants/chat.js; toggled under a
  // row lock in chatController (ES3).
  reactions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  editedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate(message) {
      if (message.senderId === message.receiverId) {
        throw new Error('Cannot send a message to yourself');
      }
    }
  },
  indexes: [
    {
      fields: ['senderId', 'receiverId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Message;

