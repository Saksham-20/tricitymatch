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
  // Retained, nullable, and never written (migration 000056 nulled every row).
  //
  // This used to hold the RAW refresh token. The old comment claimed "raw token
  // exposure on DB breach is limited" -- that was wrong: every stored value was
  // a directly replayable session credential for its full 7-day lifetime, and
  // the development database held 733 of them including unrevoked, unexpired
  // ones. Only tokenHash is ever looked up, so nothing needed the raw value.
  token: {
    type: DataTypes.STRING(512),
    allowNull: true,
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
    beforeCreate: (row) => {
      // Callers pass tokenHash explicitly. If a raw token is supplied anyway,
      // derive the hash from it and then discard it rather than persisting a
      // replayable credential.
      if (row.token) {
        if (!row.tokenHash) {
          row.tokenHash = crypto.createHash('sha256').update(row.token).digest('hex');
        }
        row.token = null;
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
  // End the access token issued with this session too, not just its refresh
  // token. (Rotation does not come through here: the old access token keeps
  // working for its remaining life, as it must.)
  if (reason !== 'rotated') {
    await require('../utils/sessionRevocation').markSessionsRevoked(await RefreshToken.sessionIdsOfFamilies([this.family], [this.id]));
  }
};

// Every row id in these families. An access token carries the id of the row it
// was issued with, which may be several rotations old, so revoking a session
// has to cover the whole family or a recently-rotated device keeps its token.
RefreshToken.sessionIdsOfFamilies = async function(families, alsoIds = []) {
  const rows = families.length
    ? await this.findAll({ where: { family: families }, attributes: ['id'] })
    : [];
  return [...alsoIds, ...rows.map((r) => r.id)];
};

// Revoke all tokens in a family (for rotation theft detection)
RefreshToken.revokeFamily = async function(family, reason = 'token_reuse_detected') {
  await require('../utils/sessionRevocation').markSessionsRevoked(await this.sessionIdsOfFamilies([family]));
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
  // Every access token issued before now is cut off as well.
  await require('../utils/sessionRevocation').markUserRevoked(userId);
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

// Never expose raw token or hash in serialized output
RefreshToken.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.token;
  delete values.tokenHash;
  return values;
};

module.exports = RefreshToken;
