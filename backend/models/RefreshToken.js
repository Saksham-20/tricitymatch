const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  token: {
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true
  },
  tokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  family: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  revokedReason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['userId'] },
    { fields: ['tokenHash'], unique: true },
    { fields: ['family'] },
    { fields: ['expiresAt'] },
    { fields: ['isRevoked'] }
  ],
  hooks: {
    beforeCreate: (token) => {
      // Hash the token for storage (we'll compare hashes, not raw tokens)
      if (token.token) {
        token.tokenHash = crypto.createHash('sha256').update(token.token).digest('hex');
      }
    }
  }
});

// Class methods
RefreshToken.generateToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

RefreshToken.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Find a valid token by its hash
RefreshToken.findValidToken = async function(tokenHash) {
  return await this.findOne({
    where: {
      tokenHash,
      isRevoked: false,
      expiresAt: { [require('sequelize').Op.gt]: new Date() }
    }
  });
};

// Revoke a token
RefreshToken.prototype.revoke = async function(reason = 'manual') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  await this.save();
};

// Revoke all tokens in a family (for rotation theft detection)
RefreshToken.revokeFamily = async function(family, reason = 'token_reuse_detected') {
  await this.update(
    {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason
    },
    { where: { family } }
  );
};

// Revoke all user tokens
RefreshToken.revokeAllUserTokens = async function(userId, reason = 'logout_all') {
  await this.update(
    {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason
    },
    { where: { userId } }
  );
};

// Cleanup expired tokens
RefreshToken.cleanupExpired = async function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await this.destroy({
    where: {
      [require('sequelize').Op.or]: [
        { expiresAt: { [require('sequelize').Op.lt]: new Date() } },
        { revokedAt: { [require('sequelize').Op.lt]: thirtyDaysAgo } }
      ]
    }
  });
};

module.exports = RefreshToken;
