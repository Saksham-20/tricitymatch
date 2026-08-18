#!/usr/bin/env node
/**
 * Load-test corpus seeder (LOCAL / STAGING ONLY).
 *
 * Creates an isolated fleet of members so a k6 run can authenticate as N distinct
 * users. This matters: every rate limiter keys on `req.user.id` once `router.use(auth)`
 * has run, so hammering one shared account measures the limiter, not the app.
 *
 * It also inflates the searchable corpus. Search over ~58 rows never touches an index
 * plan you would see in production, so p95 from a tiny corpus is meaningless.
 *
 * All rows are tagged with the LOADTEST_TAG email domain so cleanup is exact.
 *
 *   node scripts/loadtest-seed.js --users 1000 --profiles 5000
 *   node scripts/loadtest-seed.js --clean
 *
 * Refuses to run against NODE_ENV=production.
 */

/* eslint-disable no-console */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.development') });

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const TAG = 'loadtest.local';
const PASSWORD = 'LoadTest@2026';

const CITIES = ['Chandigarh', 'Mohali', 'Panchkula', 'Zirakpur', 'Kharar', 'Derabassi'];
const RELIGIONS = ['Hindu', 'Sikh', 'Jain', 'Christian', 'Muslim'];
const CASTES = ['Jat Sikh', 'Khatri', 'Arora', 'Brahmin', 'Rajput', 'Ramgarhia', 'Bhati'];
const EDUCATION = ['Bachelors', 'Masters', 'MBA', 'PhD', 'Diploma'];
const PROFESSIONS = ['Software Engineer', 'Doctor', 'Teacher', 'CA', 'Business', 'Architect'];
const MOTHER_TONGUES = ['Punjabi', 'Hindi', 'English'];
const MARITAL = ['never_married', 'divorced', 'widowed'];
const MANGLIK = ['manglik', 'non_manglik', 'anshik_manglik', 'not_sure'];
const DIET = ['vegetarian', 'non-vegetarian', 'vegan', 'jain'];
const COMPLEXION = ['fair', 'wheatish', 'dark'];
const FAMILY_TYPE = ['joint', 'nuclear'];
const FAMILY_STATUS = ['middle_class', 'upper_middle_class', 'affluent', 'rich'];
const INTERESTS = ['travel', 'music', 'cooking', 'fitness', 'reading', 'photography', 'cricket', 'yoga'];

const pick = (arr, i) => arr[i % arr.length];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('REFUSING: NODE_ENV=production. This seeder is for local/staging only.');
    process.exit(1);
  }

  const { sequelize, User, Profile } = require('../backend/models');
  // config/env.js hardcodes console.log for dev; bulk-inserting thousands of rows
  // would dump megabytes of SQL. Sequelize reads options.logging per query.
  sequelize.options.logging = false;
  await sequelize.authenticate();
  console.log(`connected: ${sequelize.config.database}`);

  if (process.argv.includes('--clean')) {
    const users = await User.findAll({
      where: { email: { [Op.like]: `%@${TAG}` } },
      attributes: ['id'],
      raw: true,
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) {
      console.log('nothing to clean');
      return sequelize.close();
    }
    await Profile.destroy({ where: { userId: { [Op.in]: ids } } });
    await User.destroy({ where: { id: { [Op.in]: ids } }, force: true });
    console.log(`cleaned ${ids.length} load-test users + profiles`);
    return sequelize.close();
  }

  const userCount = parseInt(arg('users', '1000'), 10);
  const profileCount = Math.max(parseInt(arg('profiles', '5000'), 10), userCount);

  const existing = await User.count({ where: { email: { [Op.like]: `%@${TAG}` } } });
  if (existing >= profileCount) {
    console.log(`already seeded (${existing} rows >= ${profileCount}). Use --clean to reset.`);
    return sequelize.close();
  }

  // Hash ONCE. bcrypt is deliberately slow; hashing 5000x costs minutes for no benefit
  // since every load-test account shares a password by design.
  console.log('hashing password...');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const BATCH = 500;
  let created = 0;

  for (let start = existing; start < profileCount; start += BATCH) {
    const end = Math.min(start + BATCH, profileCount);
    const users = [];
    const profiles = [];

    for (let i = start; i < end; i++) {
      const id = require('crypto').randomUUID();
      const gender = i % 2 === 0 ? 'male' : 'female';
      const ageYears = 22 + (i % 18);
      const dob = new Date(Date.now() - ageYears * 365.25 * 24 * 60 * 60 * 1000);

      users.push({
        id,
        email: `loadtest${i}@${TAG}`,
        password: passwordHash,
        phone: `9${String(100000000 + i).slice(0, 9)}`,
        role: 'user',
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
        // NOT NULL array column on Users
        refreshTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      profiles.push({
        id: require('crypto').randomUUID(),
        userId: id,
        firstName: `Load${i}`,
        lastName: pick(CASTES, i).split(' ')[0],
        gender,
        onboardingComplete: true,
        dateOfBirth: dob,
        height: 150 + (i % 40),
        weight: 45 + (i % 45),
        city: pick(CITIES, i),
        state: 'Punjab',
        country: 'India',
        religion: pick(RELIGIONS, i),
        caste: pick(CASTES, i),
        motherTongue: pick(MOTHER_TONGUES, i),
        maritalStatus: pick(MARITAL, i),
        manglikStatus: pick(MANGLIK, i),
        education: pick(EDUCATION, i),
        profession: pick(PROFESSIONS, i),
        income: 300000 + (i % 40) * 100000,
        diet: pick(DIET, i),
        skinTone: pick(COMPLEXION, i),
        familyType: pick(FAMILY_TYPE, i),
        familyStatus: pick(FAMILY_STATUS, i),
        bio: `Load-test profile ${i}. Seeded corpus row for performance testing.`,
        interestTags: [rand(INTERESTS), rand(INTERESTS)],
        photos: [],
        profileVisibility: 'everyone',
        showOnlineStatus: true,
        showLastSeen: true,
        isNri: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await User.bulkCreate(users, { validate: false, hooks: false });
    await Profile.bulkCreate(profiles, { validate: false, hooks: false });
    created += users.length;
    process.stdout.write(`\rseeded ${created}/${profileCount - existing}`);
  }

  console.log(`\ndone. ${created} users+profiles created.`);
  console.log(`login range: loadtest0@${TAG} .. loadtest${userCount - 1}@${TAG}`);
  console.log(`password: ${PASSWORD}`);
  await sequelize.close();
}

main().catch((e) => {
  console.error('\nSEED FAILED:', e.message);
  process.exit(1);
});
