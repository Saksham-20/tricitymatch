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
  // 'pending' = invited, has NOT accepted: grants no access to messages, the
  // member list or the socket room. Only 'active' is membership.
  status: {
    type: DataTypes.ENUM('pending', 'active'),
    allowNull: false,
    defaultValue: 'active',
  },
  invitedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { unique: true, fields: ['groupId', 'userId'] },
    { fields: ['userId'] },
    { fields: ['userId', 'status'] },
  ],
});

module.exports = GroupMember;
