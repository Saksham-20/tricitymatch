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
} = require('../controllers/adminController');
const { auth, adminAuth } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { adminLimiter } = require('../middlewares/security');
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
  body('planType').isIn(['free', 'premium', 'elite']),
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
  body('status').isIn(['reviewed', 'dismissed']),
  handleValidationErrors,
  updateReport
);

// ==================== INVOICES ====================

router.get('/invoice/:subscriptionId',
  param('subscriptionId').isUUID(4),
  handleValidationErrors,
  adminGetInvoice
);

module.exports = router;

