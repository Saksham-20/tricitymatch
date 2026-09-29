/**
 * Admin Routes
 * Administrative endpoints with proper authorization
 */

const express = require('express');
const router = express.Router();
const {
  getSuspicious,
  getModerationStats,
  bulkUpdateStatus,
  getPhotoQueue,
  removePhoto,
  getSupportStaff,
  assignContactMessage,
} = require('../controllers/adminSafetyController');
const {
  getUsers,
  deleteUsers,
  getUser,
  getModerationHistory,
  createUser,
  updateUserStatus,
  changeMemberIdentity,
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
  getMarketingUserReport,
  getMarketingCommission,
  updateMarketingCommission,
  getMarketingPayouts,
  createMarketingPayout,
  updateMarketingPayout,
  deleteMarketingPayout,
  getReferralCodes,
  createReferralCode,
  toggleReferralCode,
  getLeads,
  getContactMessages,
  replyToContactMessage,
  getLaunchOffer,
  updateLaunchOffer,
  getRankingWeights,
  updateRankingWeights,
  updateContactMessage,
  getSuccessStories,
  createSuccessStory,
  updateSuccessStory,
  deleteSuccessStory,
  getPlanOptions,
  cancelSubscription,
  refundSubscription,
  updateLeadStatus,
  exportUsers,
  getAdmins,
  createAdmin,
  updateUserRole,
} = require('../controllers/adminController');
const { auth, adminAuth, requireAdminScope } = require('../middlewares/auth');
const { getFunnel, getAuditLog } = require('../controllers/analyticsController');
const { handleValidationErrors, asyncHandler } = require('../middlewares/errorHandler');
const { adminLimiter } = require('../middlewares/security');
const { sendPushNotification } = require('../utils/fcm');
const { User } = require('../models');
const { Op } = require('sequelize');
const { ALL_PLANS } = require('../constants/plans');
const { 
  updateUserStatusValidation, 
  adminCreateUserValidation,
  adminCreateAdminValidation,
  updateVerificationValidation, 
  adminSearchValidation 
} = require('../validators');
const { body, param } = require('express-validator');
const { listAppeals, decideAppeal, listEvidence, getEvidence } = require('../controllers/appealController');
const { listMediaReviews, decideMediaReview } = require('../controllers/mediaReviewController');

// All admin routes require authentication and an admin-family role. Each route
// then names the permission it needs: `admin`/`super_admin` hold every scope,
// a `sub_admin` holds only what is stored on its row. The gate is here, not in
// the sidebar — a hidden nav item is a courtesy, never a boundary.
router.use(auth, adminAuth, adminLimiter);

// ==================== USER MANAGEMENT ====================

router.get('/users', requireAdminScope('users'), adminSearchValidation, handleValidationErrors, getUsers);
router.post('/users', requireAdminScope('users'), adminCreateUserValidation, handleValidationErrors, createUser);
router.delete('/users', requireAdminScope('users'), deleteUsers);
router.put('/users/bulk-status', requireAdminScope('users'), bulkUpdateStatus);
// Before /users/:userId — Express matches in declaration order, and `export`
// would otherwise be read as a user id and rejected by the UUID validator.
router.get('/users/export', requireAdminScope('users'), exportUsers);
router.get('/users/:userId', requireAdminScope('users'), param('userId').isUUID(4), handleValidationErrors, getUser);
router.get('/users/:userId/moderation-history', requireAdminScope('reports'), param('userId').isUUID(4), handleValidationErrors, getModerationHistory);
router.put('/users/:userId/status', requireAdminScope('users'), updateUserStatusValidation, handleValidationErrors, updateUserStatus);
// Appeals and preserved evidence belong to the moderation desk (`reports` scope).
router.get('/appeals', requireAdminScope('reports'), listAppeals);
router.put('/appeals/:id', requireAdminScope('reports'),
  param('id').isUUID(4),
  body('decision').isIn(['overturned', 'upheld']).withMessage('Invalid decision'),
  body('note').isString().isLength({ min: 10, max: 1000 }).withMessage('A note (10-1000 characters) is required'),
  handleValidationErrors, decideAppeal);
// Photos held by automated screening, and photos named in stolen-photo reports.
router.get('/media-reviews', requireAdminScope('reports'), listMediaReviews);
router.put('/media-reviews/:id', requireAdminScope('reports'),
  param('id').isUUID(4),
  body('decision').isIn(['approve', 'reject']).withMessage('Invalid decision'),
  body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
  handleValidationErrors, decideMediaReview);
router.get('/evidence', requireAdminScope('reports'), listEvidence);
router.get('/evidence/:id', requireAdminScope('reports'), param('id').isUUID(4), handleValidationErrors, getEvidence);

router.put('/users/:userId/identity', requireAdminScope('users'),
  param('userId').isUUID(4),
  body('dateOfBirth').optional().isISO8601().withMessage('Invalid date format'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('reason').isString().isLength({ min: 10, max: 500 }).withMessage('A reason (10-500 characters) is required'),
  handleValidationErrors,
  changeMemberIdentity
);
router.delete('/users/:userId/subscription',
  requireAdminScope('subscriptions'),
  param('userId').isUUID(4),
  handleValidationErrors,
  cancelSubscription
);
router.put('/users/:userId/subscription', requireAdminScope('subscriptions'),
  param('userId').isUUID(4),
  body('planType').isIn(ALL_PLANS),
  handleValidationErrors,
  updateSubscription
);

// ==================== MEASUREMENT ====================

router.get('/funnel', requireAdminScope('users'), getFunnel);
router.get('/audit-log', requireAdminScope('team'), getAuditLog);

// ==================== PLAN OPTIONS (grantable plans) ====================

router.get('/plan-options', requireAdminScope('subscriptions'), getPlanOptions);

// ==================== ADMIN TEAM ====================

router.get('/admins', requireAdminScope('team'), getAdmins);
router.post('/admins', requireAdminScope('team'), adminCreateAdminValidation, handleValidationErrors, createAdmin);
router.put('/users/:userId/role',
  requireAdminScope('team'),
  param('userId').isUUID(4),
  body('role').isIn(['user', 'sub_admin', 'admin', 'super_admin']),
  body('permissions').optional().isArray(),
  handleValidationErrors,
  updateUserRole
);

// ==================== VERIFICATION MANAGEMENT ====================

router.get('/verifications', requireAdminScope('verifications'), getVerifications);
router.put('/verifications/:verificationId', requireAdminScope('verifications'), updateVerificationValidation, handleValidationErrors, updateVerification);

// ==================== ANALYTICS & REVENUE ====================

router.get('/analytics', requireAdminScope('users'), getAnalytics);
router.get('/revenue', requireAdminScope('revenue'), getRevenueReport);

// ==================== REPORTS ====================

router.get('/reports', requireAdminScope('reports'), getReports);
router.get('/suspicious', requireAdminScope('reports'), getSuspicious);
router.get('/moderation-stats', requireAdminScope('reports'), getModerationStats);
router.get('/photos', requireAdminScope('reports'), getPhotoQueue);
router.delete('/photos', requireAdminScope('reports'), removePhoto);
router.put('/reports/:reportId', requireAdminScope('reports'),
  param('reportId').isUUID(4),
  body('status').isIn(['reviewing', 'resolved', 'reviewed', 'dismissed']),
  handleValidationErrors,
  updateReport
);

// ==================== INVOICES ====================

router.get('/invoice/:subscriptionId', requireAdminScope('subscriptions'),
  param('subscriptionId').isUUID(4),
  handleValidationErrors,
  adminGetInvoice
);

// Manual refund — the replacement for the automatic pro-rata refund removed
// from DELETE /subscription/current. `amount` is rupees, a human types it in
// against the published Refund & Conduct Policy; never derived automatically.
router.post('/subscriptions/:subscriptionId/refund', requireAdminScope('subscriptions'),
  param('subscriptionId').isUUID(4),
  body('amount').isFloat({ gt: 0 }),
  body('reason').optional().isString().isLength({ max: 500 }),
  handleValidationErrors,
  refundSubscription
);

// ==================== MARKETING USERS ====================

router.get('/marketing-users', requireAdminScope('marketing'), getMarketingUsers);
router.post('/marketing-users', requireAdminScope('marketing'), createMarketingUser);
router.put('/marketing-users/:userId/status', requireAdminScope('marketing'),
  param('userId').isUUID(4),
  body('status').isIn(['active', 'inactive']),
  handleValidationErrors,
  updateMarketingUserStatus
);
router.get('/marketing-commission', requireAdminScope('marketing'), getMarketingCommission);
router.put('/marketing-commission', requireAdminScope('marketing'),
  body('rate').optional().isFloat({ min: 0, max: 100 }),
  handleValidationErrors,
  updateMarketingCommission
);
router.get('/marketing-users/:userId/payouts', requireAdminScope('marketing'),
  param('userId').isUUID(4),
  handleValidationErrors,
  getMarketingPayouts
);
router.post('/marketing-users/:userId/payouts', requireAdminScope('marketing'),
  param('userId').isUUID(4),
  body('amount').isFloat({ gt: 0 }),
  body('status').optional().isIn(['pending', 'paid']),
  handleValidationErrors,
  createMarketingPayout
);
router.put('/marketing-payouts/:payoutId', requireAdminScope('marketing'),
  param('payoutId').isUUID(4),
  body('status').isIn(['pending', 'paid']),
  handleValidationErrors,
  updateMarketingPayout
);
router.delete('/marketing-payouts/:payoutId', requireAdminScope('marketing'),
  param('payoutId').isUUID(4),
  handleValidationErrors,
  deleteMarketingPayout
);
router.get('/marketing-users/:userId/report', requireAdminScope('marketing'),
  param('userId').isUUID(4),
  handleValidationErrors,
  getMarketingUserReport
);
router.get('/marketing-users/:userId/stats', requireAdminScope('marketing'),
  param('userId').isUUID(4),
  handleValidationErrors,
  getMarketingUserStats
);

// ==================== REFERRAL CODES ====================

router.get('/referral-codes', requireAdminScope('marketing'), getReferralCodes);
router.post('/referral-codes', requireAdminScope('marketing'), createReferralCode);
router.put('/referral-codes/:id/toggle', requireAdminScope('marketing'),
  param('id').isUUID(4),
  handleValidationErrors,
  toggleReferralCode
);

// ==================== MARKETING LEADS ====================

router.get('/leads', requireAdminScope('marketing'), getLeads);
router.put('/leads/:leadId/status',
  requireAdminScope('marketing'),
  param('leadId').isUUID(4),
  body('status').isIn(['new', 'contacted', 'converted', 'lost']),
  handleValidationErrors,
  updateLeadStatus
);

// ==================== CONTACT MESSAGES (SUPPORT INBOX) ====================

router.get('/contact-messages', requireAdminScope('support'), getContactMessages);
router.put(
  '/contact-messages/:id', requireAdminScope('support'),
  param('id').isUUID(4),
  body('status').isIn(['new', 'read', 'resolved']),
  handleValidationErrors,
  updateContactMessage
);
router.get('/support-staff', requireAdminScope('support'), getSupportStaff);
router.put(
  '/contact-messages/:id/assign', requireAdminScope('support'),
  param('id').isUUID(4),
  handleValidationErrors,
  assignContactMessage
);
router.post(
  '/contact-messages/:id/reply', requireAdminScope('support'),
  param('id').isUUID(4),
  body('body').isString().trim().isLength({ min: 2, max: 5000 }),
  handleValidationErrors,
  replyToContactMessage
);

// ==================== LAUNCH OFFER (PRICING) ====================

// Body shape is validated inside utils/launchOffer.saveOffer — a nested
// price/tenure map is far better checked there (one place) than re-declared as
// express-validator chains that would drift from it.
router.get('/launch-offer', requireAdminScope('pricing'), getLaunchOffer);
router.put('/launch-offer', requireAdminScope('pricing'), updateLaunchOffer);
router.get('/ranking-weights', requireAdminScope('ranking'), getRankingWeights);
router.put('/ranking-weights', requireAdminScope('ranking'), updateRankingWeights);

// ==================== SUCCESS STORIES ====================

router.get('/success-stories', requireAdminScope('stories'), getSuccessStories);
router.post('/success-stories', requireAdminScope('stories'), createSuccessStory);
router.put('/success-stories/:id', requireAdminScope('stories'), param('id').isUUID(4), handleValidationErrors, updateSuccessStory);
router.delete('/success-stories/:id', requireAdminScope('stories'), param('id').isUUID(4), handleValidationErrors, deleteSuccessStory);

// ==================== PUSH NOTIFICATION SMOKE TEST ====================

router.post('/push-smoke-test', requireAdminScope('users'), [
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

