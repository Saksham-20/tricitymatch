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
  // Admin reply (migration 000054). Recorded so the thread is auditable and a
  // second admin can see the enquiry was already answered.
  replyBody: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  repliedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  repliedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
});

module.exports = ContactMessage;
