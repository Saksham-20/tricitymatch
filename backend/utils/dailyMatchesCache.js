'use strict';

/**
 * Today's-matches set cache housekeeping.
 *
 * The ranked set is cached per member until IST midnight
 * (controllers/matchController getDailyMatches). A member who then completes
 * their profile or changes a must-have keeps the old set for up to a day, so a
 * profile save drops it and the next visit recomputes.
 */

const { delPattern } = require('./cache');
const { log } = require('../middlewares/logger');

const invalidateDailyMatches = async (userId) => {
  if (!userId) return false;
  try {
    await delPattern(`daily-matches:*:${userId}:*`);
    return true;
  } catch (error) {
    // The set expires at midnight regardless; never fail a save over it.
    log.warn('Could not drop the daily-matches cache', { error: error.message });
    return false;
  }
};

module.exports = { invalidateDailyMatches };
