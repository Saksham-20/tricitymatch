/**
 * Search Routes
 * Profile search and discovery endpoints with validation and rate limiting
 */

const express = require('express');
const router = express.Router();
const { searchProfiles, getSuggestions, getProfileByCode } = require('../controllers/searchController');
const { auth } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { searchLimiter } = require('../middlewares/security');
const { searchValidation, paginationRules } = require('../validators');
const { query } = require('express-validator');

// All search routes require authentication
router.use(auth);

// Search profiles with filters
router.get('/', 
  searchLimiter,
  searchValidation,
  handleValidationErrors,
  searchProfiles
);

// Get AI-powered suggestions
router.get('/suggestions',
  searchLimiter,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
      .toInt()
  ],
  handleValidationErrors,
  getSuggestions
);

// Look up a single profile by its public shareable code (TCS-XXXXXXXX)
router.get('/by-code',
  searchLimiter,
  [
    query('code')
      .trim()
      .isLength({ min: 8, max: 20 })
      .withMessage('Enter a valid profile ID')
  ],
  handleValidationErrors,
  getProfileByCode
);

module.exports = router;
