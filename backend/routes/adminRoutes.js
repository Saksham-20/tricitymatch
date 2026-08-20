/**
 * Admin Routes
 * Administrative endpoints with proper authorization
 */

const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUserStatus,
  updateSubscription,
  getVerifications,
  updateVerification,
  getAnalytics,
  getReports,
  updateReport,
  getRevenueReport,
  adminGetInvoice,
  getMarketingUsers,
  createMarketingUser,
  updateMarketingUserStatus,
  getMarketingUserStats,
  getReferralCodes,
  createReferralCode,
  toggleReferralCode,
  getLeads,
  getContactMessages,
  replyToContactMessage,
  getLaunchOffer,
  updateLaunchOffer,
  updateContactMessage,
  getSuccessStories,
  createSuccessStory,
  updateSuccessStory,
  deleteSuccessStory,
} = require('../controllers/adminController');
const { auth, adminAuth } = require('../middlewares/auth');
const { handleValidationErrors, asyncHandler } = require('../middlewares/errorHandler');
const { adminLimiter } = require('../middlewares/security');
const { sendPushNotification } = require('../utils/fcm');
const { User } = require('../models');
const { Op } = require('sequelize');
const { ALL_PLANS } = require('../constants/plans');
const { 
  updateUserStatusValidation, 
  updateVerificationValidation, 
  adminSearchValidation 
} = require('../validators');
const { body, param } = require('express-validator');

// All admin routes require authentication and admin role
router.use(auth, adminAuth, adminLimiter);

// ==================== USER MANAGEMENT ====================

router.get('/users', adminSearchValidation, handleValidationErrors, getUsers);
router.post('/users', createUser);
router.get('/users/:userId', param('userId').isUUID(4), handleValidationErrors, getUser);
router.put('/users/:userId/status', updateUserStatusValidation, handleValidationErrors, updateUserStatus);
router.put('/users/:userId/subscription',
  param('userId').isUUID(4),
  body('planType').isIn(ALL_PLANS),
  handleValidationErrors,
  updateSubscription
);

// ==================== VERIFICATION MANAGEMENT ====================

router.get('/verifications', getVerifications);
router.put('/verifications/:verificationId', updateVerificationValidation, handleValidationErrors, updateVerification);

// ==================== ANALYTICS & REVENUE ====================

router.get('/analytics', getAnalytics);
router.get('/revenue', getRevenueReport);

// ==================== REPORTS ====================

router.get('/reports', getReports);
router.put('/reports/:reportId',
  param('reportId').isUUID(4),
  body('status').isIn(['reviewing', 'resolved', 'reviewed', 'dismissed']),
  handleValidationErrors,
  updateReport
);

// ==================== INVOICES ====================

router.get('/invoice/:subscriptionId',
  param('subscriptionId').isUUID(4),
  handleValidationErrors,
  adminGetInvoice
);

// ==================== MARKETING USERS ====================

router.get('/marketing-users', getMarketingUsers);
router.post('/marketing-users', createMarketingUser);
router.put('/marketing-users/:userId/status',
  param('userId').isUUID(4),
  body('status').isIn(['active', 'inactive']),
  handleValidationErrors,
  updateMarketingUserStatus
);
router.get('/marketing-users/:userId/stats',
  param('userId').isUUID(4),
  handleValidationErrors,
  getMarketingUserStats
);

// ==================== REFERRAL CODES ====================

router.get('/referral-codes', getReferralCodes);
router.post('/referral-codes', createReferralCode);
router.put('/referral-codes/:id/toggle',
  param('id').isUUID(4),
  handleValidationErrors,
  toggleReferralCode
);

// ==================== MARKETING LEADS ====================

router.get('/leads', getLeads);

// ==================== CONTACT MESSAGES (SUPPORT INBOX) ====================

router.get('/contact-messages', getContactMessages);
router.put(
  '/contact-messages/:id',
  param('id').isUUID(4),
  body('status').isIn(['new', 'read', 'resolved']),
  handleValidationErrors,
  updateContactMessage
);
router.post(
  '/contact-messages/:id/reply',
  param('id').isUUID(4),
  body('body').isString().trim().isLength({ min: 2, max: 5000 }),
  handleValidationErrors,
  replyToContactMessage
);

// ==================== LAUNCH OFFER (PRICING) ====================

// Body shape is validated inside utils/launchOffer.saveOffer — a nested
// price/tenure map is far better checked there (one place) than re-declared as
// express-validator chains that would drift from it.
router.get('/launch-offer', getLaunchOffer);
router.put('/launch-offer', updateLaunchOffer);

// ==================== SUCCESS STORIES ====================

router.get('/success-stories', getSuccessStories);
router.post('/success-stories', createSuccessStory);
router.put('/success-stories/:id', param('id').isUUID(4), handleValidationErrors, updateSuccessStory);
router.delete('/success-stories/:id', param('id').isUUID(4), handleValidationErrors, deleteSuccessStory);

// ==================== PUSH NOTIFICATION SMOKE TEST ====================

router.post('/push-smoke-test', [
  body('userId').optional().isUUID(4).withMessage('Invalid userId'),
  body('title').optional().isString().trim().isLength({ max: 100 }),
  body('body').optional().isString().trim().isLength({ max: 200 }),
  handleValidationErrors,
], asyncHandler(async (req, res) => {
  const { userId, title = 'TricityMatch Test', body: msgBody = 'Push notifications are working!' } = req.body;

  if (userId) {
    const user = await User.findByPk(userId, { attributes: ['id', 'fcmTokens'] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.fcmTokens?.length) {
      return res.json({ success: false, message: 'User has no FCM tokens registered' });
    }
    const result = await sendPushNotification(user.fcmTokens, title, msgBody, { type: 'smoke_test' });
    return res.json({ success: true, userId, ...result });
  }

  // Broadcast to up to 5 recently-active users with FCM tokens
  const users = await User.findAll({
    where: { fcmTokens: { [Op.ne]: null } },
    attributes: ['id', 'fcmTokens'],
    limit: 5,
    order: [['updatedAt', 'DESC']],
  });

  const usersWithTokens = users.filter((u) => u.fcmTokens?.length > 0);
  if (!usersWithTokens.length) {
    return res.json({ success: false, message: 'No users with FCM tokens found' });
  }

  const allTokens = usersWithTokens.flatMap((u) => u.fcmTokens);
  const result = await sendPushNotification(allTokens, title, msgBody, { type: 'smoke_test' });
  return res.json({ success: true, usersTargeted: usersWithTokens.length, tokensTargeted: allTokens.length, ...result });
}));

module.exports = router;

