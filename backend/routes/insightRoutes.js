const express = require('express');
const { query } = require('express-validator');
const {
  getProfileViews,
  getPersonalStats,
  getEngagementInsights,
  getCompatibilityInsights,
  getProfilePerformance
} = require('../controllers/insightController');
const { authMiddleware, premiumMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation rules
const insightsValidation = [
  query('period').optional().isIn(['7d', '30d', '90d']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
];

// Routes
router.get('/profile-views', premiumMiddleware, getProfileViews);
router.get('/stats', getPersonalStats);
router.get('/engagement', insightsValidation, getEngagementInsights);
router.get('/compatibility', insightsValidation, getCompatibilityInsights);
router.get('/performance', getProfilePerformance);

module.exports = router;
