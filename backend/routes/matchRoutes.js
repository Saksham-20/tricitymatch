const express = require('express');
const { body, query } = require('express-validator');
const {
  getSuggestions,
  searchProfiles,
  likeProfile,
  shortlistProfile,
  getLikedBy,
  getMyLikes,
  getShortlists,
  removeShortlist,
  getKundliMatch
} = require('../controllers/matchController');
const { authMiddleware, premiumMiddleware } = require('../middlewares/authMiddleware');
const { searchLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Validation rules
const searchValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('ageMin').optional().isInt({ min: 18, max: 80 }),
  query('ageMax').optional().isInt({ min: 18, max: 80 }),
  query('heightMin').optional().isInt({ min: 120, max: 220 }),
  query('heightMax').optional().isInt({ min: 120, max: 220 }),
  query('religion').optional().trim(),
  query('caste').optional().trim(),
  query('education').optional().trim(),
  query('profession').optional().trim(),
  query('city').optional().trim(),
  query('diet').optional().isIn(['vegetarian', 'non-vegetarian', 'vegan', 'jain']),
  query('smoking').optional().isIn(['yes', 'no', 'occasionally']),
  query('drinking').optional().isIn(['yes', 'no', 'occasionally']),
  query('kundliMatch').optional().isBoolean(),
  query('sortBy').optional().isIn(['compatibility', 'recent', 'age', 'height'])
];

const likeValidation = [
  body('likedUserId').isUUID().withMessage('Valid user ID required')
];

const shortlistValidation = [
  body('shortlistedUserId').isUUID().withMessage('Valid user ID required')
];

const kundliValidation = [
  body('userId1').isUUID().withMessage('Valid user ID required'),
  body('userId2').isUUID().withMessage('Valid user ID required')
];

// Routes
router.get('/suggestions', getSuggestions);
router.get('/search', searchLimiter, searchValidation, searchProfiles);
router.post('/like', likeValidation, likeProfile);
router.post('/shortlist', shortlistValidation, shortlistProfile);
router.get('/liked-by', premiumMiddleware, getLikedBy);
router.get('/my-likes', getMyLikes);
router.get('/shortlists', getShortlists);
router.delete('/shortlist/:userId', removeShortlist);
router.post('/kundli-match', kundliValidation, getKundliMatch);

module.exports = router;
