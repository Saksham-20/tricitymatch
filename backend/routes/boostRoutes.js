const express = require('express');
const { query } = require('express-validator');
const {
  getBoostStatus,
  getBoostHistory,
  getActiveBoosts
} = require('../controllers/boostController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation rules
const boostValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
];

// Routes
router.get('/status', getBoostStatus);
router.get('/history', boostValidation, getBoostHistory);
router.get('/active', getActiveBoosts);

module.exports = router;
