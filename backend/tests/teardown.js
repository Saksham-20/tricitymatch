/**
 * Jest Global Teardown
 * Cleanup after all tests complete
 */

module.exports = async () => {
  // Close any open database connections
  try {
    const sequelize = require('../config/database');
    if (sequelize && sequelize.close) {
      await sequelize.close();
    }
  } catch (error) {
    // Ignore errors during cleanup
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
};
