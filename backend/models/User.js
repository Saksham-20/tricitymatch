const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // null for OAuth-only users
    validate: {
      len: [8, 100]
    }
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'super_admin', 'marketing_manager', 'marketing'),
    defaultValue: 'user'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'banned', 'pending', 'deleted'),
    defaultValue: 'pending'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  phoneVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  referralCodeUsed: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referredByMarketingUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isBoosted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  boostExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, config.auth.bcryptRounds);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, config.auth.bcryptRounds);
      }
    }
  }
});

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Override toJSON to exclude sensitive fields from API responses
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Remove sensitive fields
  delete values.password;
  
  return values;
};

module.exports = User;

