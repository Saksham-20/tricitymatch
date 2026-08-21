/**
 * Admin Seeder
 * Creates an admin user from environment variables.
 * Safe to run multiple times — uses upsert.
 *
 * Usage: node backend/seeders/adminSeeder.js
 */

const path = require('path');

// Load the env file matching NODE_ENV. This previously hardcoded
// '.env.development', so running the seeder with NODE_ENV=production still
// pulled development database credentials — the seeder and the app disagreed
// about which database they were pointed at.
const NODE_ENV = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.resolve(__dirname, `../../.env.${NODE_ENV}`) });
if (!process.env.ADMIN_EMAIL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

const sequelize = require('../config/database');
const User = require('../models/User');
const Profile = require('../models/Profile');

const IS_PRODUCTION = NODE_ENV === 'production';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tricitymatch.com';

// Opt-in, never implicit. The seeder used to re-hash ADMIN_PASSWORD onto an
// EXISTING admin on every run, so a routine `node seeders/adminSeeder.js`
// silently reset the live admin password to whatever the default was.
const RESET_EXISTING_PASSWORD = process.env.ADMIN_SEED_RESET_PASSWORD === 'true';

// The default was 'Pass@1234' — a value published in tracked documentation and
// reused by three scripts. In production there is no default at all.
const DEV_FALLBACK_PASSWORD = 'Pass@1234';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
  || (IS_PRODUCTION ? null : DEV_FALLBACK_PASSWORD);

// Mirrors the application's own password policy (8+, upper, lower, digit, symbol).
const isStrongPassword = (pw) => typeof pw === 'string'
  && pw.length >= 8
  && /[a-z]/.test(pw) && /[A-Z]/.test(pw)
  && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);

const assertSeedPreconditions = () => {
  if (!ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_PASSWORD must be set explicitly when seeding in production. '
      + 'There is no default admin password outside development.'
    );
  }
  if (IS_PRODUCTION && ADMIN_PASSWORD === DEV_FALLBACK_PASSWORD) {
    throw new Error(
      'ADMIN_PASSWORD is the well-known development default and cannot be used in production.'
    );
  }
  if (IS_PRODUCTION && !isStrongPassword(ADMIN_PASSWORD)) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 8 characters with upper, lower, digit and symbol.'
    );
  }
};

async function seed() {
  try {
    assertSeedPreconditions();

    await sequelize.authenticate();
    console.log('[seeder] Database connected.');

    // Check if admin already exists
    const existing = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (existing) {
      // Role and status are safe to re-assert; the password is NOT. Overwriting
      // it unprompted is how a routine seeder run resets a live admin login.
      existing.role = 'admin';
      existing.status = 'active';
      existing.emailVerified = true;

      if (RESET_EXISTING_PASSWORD) {
        existing.password = ADMIN_PASSWORD; // beforeUpdate hook re-hashes
        await existing.save();
        console.log(`[seeder] ✅ Admin updated and PASSWORD RESET: ${ADMIN_EMAIL}`);
      } else {
        await existing.save();
        console.log(`[seeder] ✅ Admin role/status synced: ${ADMIN_EMAIL}`);
        console.log('[seeder] ℹ  Password left unchanged. Set ADMIN_SEED_RESET_PASSWORD=true to reset it.');
      }
      return;
    }

    // Create admin user (password hashed by User model beforeCreate hook)
    const admin = await User.create({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      status: 'active',
      emailVerified: true,
    });

    // Create a minimal profile for the admin
    await Profile.create({
      userId: admin.id,
      firstName: 'Admin',
      lastName: 'TricityMatch',
      gender: 'other',
      dateOfBirth: new Date('1990-01-01'),
    });

    console.log(`[seeder] ✅ Admin user created successfully: ${ADMIN_EMAIL}`);
    console.log('[seeder] ⚠  Change the admin password after first login!');
  } catch (err) {
    console.error('[seeder] ❌ Error:', err.message);
    throw err;
  }
}

// Allow running the seeder directly: `node backend/seeders/adminSeeder.js`.
// Without this, requiring the file only defines the functions (up/down) and
// never runs seed(), so the documented command was a silent no-op.
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await seed();
  },
  down: async (queryInterface, Sequelize) => {
    // Admin user deletion not typically done in down, but we can delete the profile and user if needed
    const User = require('../models/User');
    await User.destroy({ where: { email: ADMIN_EMAIL } });
  }
};
