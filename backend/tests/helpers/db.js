'use strict';

/**
 * Real-Postgres helpers for tests/integration/db.
 *
 * Locally the suites skip themselves when no test database answers, so
 * `npm test` still works on a laptop without one. CI sets REQUIRE_DB_TESTS=1,
 * which turns an unreachable database into a failure instead of a silent skip:
 * a green run must mean the database tests ran.
 */

const crypto = require('crypto');

const REQUIRED = process.env.REQUIRE_DB_TESTS === '1';

// Every test file gets a fresh module registry, so each file that touches the
// database opens its own pool (min 5 connections) and nothing closed it: a
// worker that ran ~20 files held ~100 connections and Postgres answered
// "too many clients" once there were enough suites. A ROOT-level afterAll runs
// after every describe-level afterAll, so it cannot close the pool before a
// suite's own cleanup (the reason describeDb itself does not close it).
if (typeof afterAll === 'function') {
  afterAll(async () => {
    try { await require('../../config/database').close(); } catch (_) { /* already closed */ }
  });
}

const connect = async () => {
  const sequelize = require('../../config/database');
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query('SELECT COUNT(*)::int AS n FROM "SequelizeMeta"');
    if (!rows[0].n) throw new Error('test database has no migrations applied (run npm run migrate:test)');
    return sequelize;
  } catch (err) {
    if (REQUIRED) throw new Error(`REQUIRE_DB_TESTS=1 but the test database is unusable: ${err.message}`);
    return null;
  }
};

/**
 * Registers a describe block whose tests run only when the database is usable.
 * `t(name, fn)` is `it` with that guard; a skipped run says so in the summary.
 */
const describeDb = (name, body) => {
  let usable = null;
  describe(name, () => {
    beforeAll(async () => { usable = await connect(); });
    // No close() here: afterAll hooks run in registration order, so closing the
    // pool in this hook would run before the suite's own cleanup and leave every
    // test row behind. Jest's forceExit ends the process.
    const t = (title, fn) => it(title, async () => {
      if (!usable) {
        // eslint-disable-next-line no-console
        console.warn(`[skipped: no test database] ${name} > ${title}`);
        return;
      }
      await fn(usable);
    });
    body(t);
  });
};

const uniq = () => crypto.randomBytes(5).toString('hex');

const makeMember = async (overrides = {}) => {
  const { User, Profile } = require('../../models');
  const tag = uniq();
  const user = await User.create({
    email: `it-${tag}@example.test`,
    password: 'Pass@1234-hash-not-used',
    role: 'user',
    status: 'active',
    ...(overrides.user || {}),
  });
  const profile = await Profile.create({
    userId: user.id,
    firstName: 'It',
    lastName: tag,
    gender: 'female',
    dateOfBirth: '1996-04-12',
    isActive: true,
    profileVisibility: 'everyone',
    ...(overrides.profile || {}),
  });
  return { user, profile };
};

const removeMembers = async (ids) => {
  if (!ids.length) return;
  const sequelize = require('../../config/database');
  const q = (sql) => sequelize.query(sql, { replacements: { ids } });
  await q('DELETE FROM "ProfileViews" WHERE "viewerId" IN (:ids) OR "viewedUserId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "ContactUnlocks" WHERE "userId" IN (:ids) OR "targetUserId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "AnalyticsEvents" WHERE "userId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "Notifications" WHERE "userId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "Blocks" WHERE "blockerId" IN (:ids) OR "blockedUserId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "ChatGrants" WHERE "freeUserId" IN (:ids) OR "otherUserId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "Matches" WHERE "userId" IN (:ids) OR "matchedUserId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "Subscriptions" WHERE "userId" IN (:ids)').catch(() => {});
  await q('DELETE FROM "Profiles" WHERE "userId" IN (:ids)').catch(() => {});
  // Not swallowed: a user row left behind would collide with the next run's
  // unique email/phone and turn a cleanup problem into a confusing failure.
  await q('DELETE FROM "Users" WHERE id IN (:ids)');
};

/** Minimal Express req/res pair for calling a controller directly. */
const call = async (handler, { user, params = {}, body = {}, query = {}, files }) => {
  const res = {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; this._done(); return this; },
    send(b) { this.body = b; this._done(); return this; },
    setHeader(k, v) { (this.headers = this.headers || {})[k.toLowerCase()] = v; return this; },
  };
  return new Promise((resolve) => {
    res._done = () => resolve(res);
    const next = (err) => {
      res.statusCode = (err && err.statusCode) || 500;
      res.body = { error: err };
      resolve(res);
    };
    handler({ user, params, body, query, files, headers: {}, ip: '127.0.0.1', get: () => '', app: { get: () => null } }, res, next);
  });
};

/**
 * Like `call`, for a handler that STREAMS its response (res.write / res.end),
 * such as the CSV exports. Resolves once the response ends, with the whole body.
 */
const callStream = (handler, { user, params = {}, body = {}, query = {} }) => new Promise((resolve, reject) => {
  const { PassThrough } = require('stream');
  const res = new PassThrough();
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  let text = '';
  res.setEncoding('utf8');
  res.on('data', (d) => { text += d; });
  res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: text }));
  res.on('error', reject);
  const next = (err) => resolve({ statusCode: (err && err.statusCode) || 500, headers: res.headers, body: { error: err } });
  handler({ user, params, body, query, headers: {}, ip: '127.0.0.1', get: () => '', app: { get: () => null } }, res, next);
});

module.exports = { describeDb, makeMember, removeMembers, call, callStream, uniq };
