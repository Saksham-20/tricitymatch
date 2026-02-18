/**
 * Database Configuration
 * Uses centralized config module
 */

const { Sequelize } = require('sequelize');
const config = require('./env');

const sequelize = new Sequelize(
  config.database.name,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    logging: config.database.logging,
    pool: config.database.pool,
    dialectOptions: config.database.ssl ? {
      ssl: config.database.ssl
    } : {},
    define: {
      timestamps: true,
      underscored: false,
    },
    // Retry logic for transient failures
    retry: {
      max: 3,
      backoffBase: 1000,
      backoffExponent: 1.5,
    },
  }
);

module.exports = sequelize;
