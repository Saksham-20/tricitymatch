const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Public contact-form enquiries. Stored durably (independent of SMTP, which is
// config-gated) so support always has the record; a best-effort email is sent
// on top when email is configured.
const ContactMessage = sequelize.define('ContactMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('new', 'read', 'resolved'),
    allowNull: false,
    defaultValue: 'new',
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = ContactMessage;
