/**
 * Match Routes
 * Matching/swiping endpoints with validation and rate limiting
 */

const express = require('express');
const router = express.Router();
const {
  matchAction,
  getLikes,
  getShortlist,
  getSentInterests,
  getMutualMatches,
  getDailyMatches
} = require('../controllers/matchController');
const { auth, requirePremium, verifyTargetUser } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { matchActionLimiter } = require('../middlewares/security');
const { matchActionValidation, paginationRules } = require('../validators');

// All match routes require authentication
router.use(auth);

// Matches of the day (cached daily set; free 5 / premium 15)
router.get('/daily', getDailyMatches);

// Perform match action (like/shortlist/pass) - rate limited for swiping
router.post('/:userId', 
  matchActionLimiter,
  matchActionValidation,
  handleValidationErrors,
  verifyTargetUser('userId'),
  matchAction
);

// Get profiles that liked the current user (premium only)
router.get('/likes', 
  requirePremium,
  paginationRules,
  handleValidationErrors,
  getLikes
);

// Get shortlisted profiles
router.get('/shortlist', 
  paginationRules,
  handleValidationErrors,
  getShortlist
);

// Get profiles the current user has liked (sent interests) — D3
router.get('/sent',
  paginationRules,
  handleValidationErrors,
  getSentInterests
);

// Get mutual matches
router.get('/mutual', 
  paginationRules,
  handleValidationErrors,
  getMutualMatches
);

module.exports = router;
