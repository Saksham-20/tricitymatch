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
    allowNull: true, // null for phone-only accounts (flexible auth)
    unique: true,
    validate: {
      isEmailOrNull(value) {
        if (value === null || value === undefined || value === '') return;
        // mirror Sequelize's isEmail without rejecting null
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error('Validation isEmail on email failed');
        }
      }
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
    allowNull: true,
    validate: {
      isIndianPhone(value) {
        if (value && !/^[6-9]\d{9}$/.test(value)) {
          throw new Error('Phone must be a valid 10-digit Indian mobile number');
        }
      }
    }
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
  },
  fcmTokens: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: false,
    defaultValue: []
  }
}, {
  hooks: {
    // "A user must always have at least one contact channel" is enforced via
    // hooks, NOT a model-level `validate` block: model validators also fire on
    // bulk `User.update(values, {where})` with an instance where isNewRecord is
    // true and only the changed fields are set, making a partial update
    // (isBoosted, fcmTokens, status) indistinguishable from a create — which
    // false-rejected those updates. beforeCreate runs only on real creates;
    // beforeUpdate (per-instance saves only, never bulk update) runs only when
    // email/phone actually change.
    beforeCreate: async (user) => {
      if (!user.email && !user.phone) {
        throw new Error('An email address or phone number is required');
      }
      if (user.password) {
        user.password = await bcrypt.hash(user.password, config.auth.bcryptRounds);
      }
    },
    beforeUpdate: async (user) => {
      if ((user.changed('email') || user.changed('phone')) && !user.email && !user.phone) {
        throw new Error('An email address or phone number is required');
      }
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

