const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * GroupMessage — a message posted to a family group by a member.
 */
const GroupMessage = sequelize.define('GroupMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Groups', key: 'id' },
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { notEmpty: true, len: [1, 2000] },
  },
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  editedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['groupId', 'createdAt'] },
  ],
});

module.exports = GroupMessage;
