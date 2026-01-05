const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', `.env.${process.env.NODE_ENV || 'development'}`) });

const env = process.env.NODE_ENV || 'development';
const config = require('./config.js')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: config.logging,
  dialectOptions: config.dialectOptions || {}
});

module.exports = sequelize;

