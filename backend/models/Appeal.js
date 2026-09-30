const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A suspended member's appeal. Keyed by email because the member cannot sign in;
 * `userId` is filled only when the email matches an account (the API answers the
 * same way either way, so this is not an account-existence oracle).
 */
const Appeal = sequelize.define('Appeal', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: true, references: { model: 'Users', key: 'id' } },
  email: { type: DataTypes.STRING(255), allowNull: false },
  statement: { type: DataTypes.TEXT, allowNull: false },
  // pending -> overturned | upheld
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
  decidedBy: { type: DataTypes.UUID, allowNull: true, references: { model: 'Users', key: 'id' } },
  decisionNote: { type: DataTypes.TEXT, allowNull: true },
  decidedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['status', 'createdAt'] }],
});

module.exports = Appeal;
