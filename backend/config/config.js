/**
 * Sequelize CLI Configuration
 * Used by sequelize-cli for migrations and seeders.
 *
 * This file used to declare its own connection settings by reading process.env
 * directly. That produced a second, silently divergent source of truth:
 *
 *   - It reintroduced `DB_USER || 'postgres'` and `DB_PASSWORD || 'root'`, the
 *     exact weak defaults config/env.js refuses to boot with in production.
 *   - It keyed SSL off `DB_SSL` while the application keys off `DB_DISABLE_SSL`
 *     — opposite polarity, different variable — so migrations connected under
 *     different TLS settings than the app that ran against the same database.
 *   - Its pool sizes disagreed with both env.js and docker-compose.
 *
 * It now derives everything from config/env.js, which is the project's single
 * env source and carries the production startup guards. A migration run in
 * production therefore fails closed on the same conditions the app does.
 */

const config = require('./env');

const base = {
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  host: config.database.host,
  port: config.database.port,
  dialect: config.database.dialect,
  pool: config.database.pool,
  // dialectOptions is only set when env.js resolved real SSL settings, so the
  // CLI and the app agree on transport security by construction.
  ...(config.database.ssl ? { dialectOptions: { ssl: config.database.ssl } } : {}),
};

// Migrations are DDL; echoing them is useful and carries no bind parameters.
// Application query logging (which does carry user data) stays governed by
// config.database.logging in config/database.js.
const withLogging = (logging) => ({ ...base, logging });

module.exports = {
  development: withLogging(console.log),
  test: withLogging(false),
  production: withLogging(false),
};
