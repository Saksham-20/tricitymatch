/**
 * Authentication Routes
 * All auth-related endpoints with proper validation and rate limiting
 */

const express = require('express');
const router = express.Router();
const { 
  signup, 
  login, 
  getMe, 
  forgotPassword, 
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  getSessions,
  revokeSession
} = require('../controllers/authController');
const { auth } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { 
  authLimiter, 
  signupLimiter, 
  passwordResetLimiter 
} = require('../middlewares/security');
const { 
  signupValidation, 
  loginValidation, 
  forgotPasswordValidation, 
  resetPasswordValidation,
  refreshTokenValidation
} = require('../validators');
const { body, param } = require('express-validator');

// ==================== PUBLIC ROUTES ====================

// Signup - strict rate limiting
router.post('/signup', 
  signupLimiter, 
  signupValidation, 
  handleValidationErrors, 
  signup
);

// Login - auth rate limiting with account lockout check
router.post('/login', 
  authLimiter,
  loginValidation, 
  handleValidationErrors, 
  login
);

// Refresh token - moderate rate limiting
router.post('/refresh', 
  authLimiter,
  refreshTokenValidation,
  handleValidationErrors,
  refreshToken
);

// Forgot password - strict rate limiting
router.post('/forgot-password', 
  passwordResetLimiter, 
  forgotPasswordValidation, 
  handleValidationErrors, 
  forgotPassword
);

// Reset password - strict rate limiting
router.post('/reset-password', 
  passwordResetLimiter, 
  resetPasswordValidation, 
  handleValidationErrors, 
  resetPassword
);

// ==================== PROTECTED ROUTES ====================

// Get current user
router.get('/me', auth, getMe);

// Logout current session
router.post('/logout', auth, logout);

// Logout all sessions
router.post('/logout-all', auth, logoutAll);

// Change password
router.post('/change-password', 
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  ],
  handleValidationErrors,
  changePassword
);

// Get active sessions
router.get('/sessions', auth, getSessions);

// Revoke a specific session
router.delete('/sessions/:sessionId',
  auth,
  [param('sessionId').isUUID(4).withMessage('Invalid session ID')],
  handleValidationErrors,
  revokeSession
);

module.exports = router;
