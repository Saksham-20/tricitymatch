const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Family Group — a private space where a user and their invited family members
 * discuss a candidate profile (e.g. parents + siblings reviewing a match).
 */
const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true, len: [1, 100] },
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: [0, 500] },
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  // Optional: the candidate profile this family group is discussing.
  candidateUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { fields: ['createdBy'] },
  ],
});

module.exports = Group;
