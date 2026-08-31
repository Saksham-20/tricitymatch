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
    type: DataTypes.ENUM('user', 'sub_admin', 'admin', 'super_admin', 'marketing_manager', 'marketing'),
    defaultValue: 'user'
  },
  // Scope keys for `sub_admin` accounts (constants/adminScopes.js). NULL for
  // every other role: admin/super_admin hold every scope implicitly, so a
  // stored copy for them would go stale the moment a scope is added.
  adminPermissions: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'banned', 'pending', 'deleted'),
    defaultValue: 'pending'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // DPDP consent record: when the holder accepted the Terms/Privacy checkbox
  // at signup, and which version (backend/constants/legal.js TERMS_VERSION).
  // NULL on pre-record accounts — never treated as "did not accept".
  termsAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  termsVersion: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: null
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
  },
  // ── Founding members + invites (Phase S, migration 000048) ──
  // Founding-ness is a User fact, NOT "has a founding_premium subscription":
  // the granted row is cancelled when the member upgrades (verifyPayment
  // supersedes it) and expires for the whole cohort at FOUNDING_PERIOD_ENDS.
  // The badge has to survive both.
  isFoundingMember: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // ≥128-bit random hex, minted lazily by utils/inviteToken.js. Never derived
  // from the userId: utils/profileCode.js codes resolve to a whole profile via
  // GET /search/by-code, and an invite token must only ever resolve to a first
  // name. Unique index `users_invite_token` is the collision backstop.
  inviteToken: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  // Unlock credits earned before the member had anywhere to put them (see
  // migration 000055). Moved onto `Subscription.contactUnlocksAllowed` the
  // moment a subscription becomes active, so the entitlement is still read from
  // exactly one place. NEVER read directly by a gate.
  pendingUnlockCredits: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Self-FK to the inviting member. ON DELETE SET NULL (migration 000048) so
  // removing an inviter never cascades away the accounts they brought in.
  invitedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
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
  // The invite token is a bearer-ish secret for ONE surface (resolve → first
  // name). Several endpoints serialize a User that isn't the caller's own
  // (admin lists, profile includes), so it never rides the generic user shape —
  // the owner reads it from GET /invite/my-link and nowhere else.
  delete values.inviteToken;

  // Device push tokens. Anything holding these can send push notifications that
  // appear to come from us, to that member's devices. They were never stripped,
  // so any endpoint serialising a whole User instance emitted every registered
  // device token for that account.
  delete values.fcmTokens;

  // Third-party account identifier. Not a credential, but it links this member
  // to an external identity and nothing in the API needs it.
  delete values.googleId;

  return values;
};

module.exports = User;

