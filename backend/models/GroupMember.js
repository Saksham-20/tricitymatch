const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * GroupMember — membership of a user in a family group. Membership is the
 * authorization boundary for reading/writing group messages (prevents IDOR).
 */
const GroupMember = sequelize.define('GroupMember', {
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
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  role: {
    type: DataTypes.ENUM('owner', 'member'),
    allowNull: false,
    defaultValue: 'member',
  },
}, {
  indexes: [
    { unique: true, fields: ['groupId', 'userId'] },
    { fields: ['userId'] },
  ],
});

module.exports = GroupMember;
