/**
 * Admin Routes
 * Administrative endpoints with proper authorization
 */

const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  updateUserStatus, 
  getVerifications, 
  updateVerification, 
  getAnalytics,
  getReports
} = require('../controllers/adminController');
const { auth, adminAuth } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { adminLimiter } = require('../middlewares/security');
const { 
  updateUserStatusValidation, 
  updateVerificationValidation, 
  adminSearchValidation 
} = require('../validators');

// All admin routes require authentication and admin role
router.use(auth, adminAuth, adminLimiter);

// ==================== USER MANAGEMENT ====================

// Get all users with filters
router.get('/users', 
  adminSearchValidation,
  handleValidationErrors,
  getUsers
);

// Update user status
router.put('/users/:userId/status', 
  updateUserStatusValidation,
  handleValidationErrors,
  updateUserStatus
);

// ==================== VERIFICATION MANAGEMENT ====================

// Get pending verifications
router.get('/verifications', getVerifications);

// Approve/reject verification
router.put('/verifications/:verificationId', 
  updateVerificationValidation,
  handleValidationErrors,
  updateVerification
);

// ==================== ANALYTICS ====================

// Get analytics data
router.get('/analytics', getAnalytics);

// ==================== REPORTS ====================

// Get reported users/issues
router.get('/reports', getReports);

module.exports = router;
