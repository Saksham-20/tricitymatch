/**
 * Admin Seeder
 * Creates an admin user from environment variables.
 * Safe to run multiple times — uses upsert.
 *
 * Usage: node backend/seeders/adminSeeder.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
// Also try .env if .env.development doesn't exist
if (!process.env.ADMIN_EMAIL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

const sequelize = require('../config/database');
const User = require('../models/User');
const Profile = require('../models/Profile');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tricitymatch.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pass@1234';

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('[seeder] Database connected.');

    // Check if admin already exists
    const existing = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (existing) {
      // Always sync role, status, and password to ensure credentials are correct
      existing.role = 'admin';
      existing.status = 'active';
      existing.emailVerified = true;
      existing.password = ADMIN_PASSWORD; // beforeUpdate hook will re-hash this
      await existing.save();
      console.log(`[seeder] ✅ Admin user updated: ${ADMIN_EMAIL}`);
      process.exit(0);
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
