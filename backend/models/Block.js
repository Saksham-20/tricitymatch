const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Block = sequelize.define('Block', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  blockerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  blockedUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { unique: true, fields: ['blockerId', 'blockedUserId'] },
    { fields: ['blockerId'] },
    { fields: ['blockedUserId'] },
  ],
});

module.exports = Block;
