/**
 * Search Routes
 * Profile search and discovery endpoints with validation and rate limiting
 */

const express = require('express');
const router = express.Router();
const { searchProfiles, getSuggestions } = require('../controllers/searchController');
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

module.exports = router;
