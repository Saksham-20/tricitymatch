const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Admin-editable runtime settings (key → JSONB). See migration 000053.
// Read through `utils/launchOffer.js`, never directly from a controller: that
// module owns the defaults, the shape validation and the in-process cache.
const AppSetting = sequelize.define('AppSetting', {
  key: {
    type: DataTypes.STRING(64),
    primaryKey: true,
    allowNull: false,
  },
  value: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'AppSettings',
  timestamps: true,
});

module.exports = AppSetting;
