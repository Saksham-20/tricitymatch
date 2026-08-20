/**
 * Block & Report Routes
 */

const express = require('express');
const router = express.Router();
const { matchActionLimiter } = require('../middlewares/security');
const { blockUser, unblockUser, getBlockedUsers, reportUser } = require('../controllers/blockReportController');
const { auth } = require('../middlewares/auth');
const { param, body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/errorHandler');

const userIdParam = [
  param('userId').isUUID(4).withMessage('Invalid user ID'),
  handleValidationErrors,
];

const reportBody = [
  body('reason')
    .isIn(['fake_profile', 'harassment', 'spam', 'inappropriate_content', 'underage', 'other'])
    .withMessage('Invalid reason'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  handleValidationErrors,
];

// Abuse reporting and blocking both write rows keyed to another user and had
// only the global limiter in front of them — enough to spam the moderation
// queue. matchActionLimiter (60/min per user) matches the neighbouring
// per-user-action endpoints.
// Block routes — /api/block
router.post('/:userId', auth, matchActionLimiter, userIdParam, blockUser);
router.delete('/:userId', auth, matchActionLimiter, userIdParam, unblockUser);
router.get('/', auth, getBlockedUsers);

// Report routes — /api/report
const reportRouter = express.Router();
reportRouter.post('/:userId', auth, matchActionLimiter, userIdParam, reportBody, reportUser);

module.exports = { blockRouter: router, reportRouter };
