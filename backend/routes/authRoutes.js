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
  revokeSession,
  deleteAccount,
  sendOtp,
  verifyOtp,
  googleAuth,
  requestEmailChange,
  verifyEmailChange,
} = require('../controllers/authController');
const { auth } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const {
  authLimiter,
  otpLimiter,
  signupLimiter,
  passwordResetLimiter,
  checkAccountLockout
} = require('../middlewares/security');
const {
  signupValidation,
  loginValidation,
  changeEmailRequestValidation,
  changeEmailVerifyValidation,
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
  checkAccountLockout,
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

// Google OAuth — verify Google ID token, sign in or register
router.post('/google', authLimiter, googleAuth);

// OTP endpoints — use dedicated limiter (10/10min) so signup flow doesn't exhaust auth pool.
// VAL-1: validate target format so the email path can't be used as an open mailer and
// garbage phone numbers never reach the SMS provider.
const otpTargetValidation = [
  body('type').isIn(['email', 'phone']).withMessage('type must be "email" or "phone"'),
  body('target')
    .custom((value, { req }) => {
      if (req.body.type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''))) {
          throw new Error('A valid email is required');
        }
      } else {
        // E.164-ish: optional +, 10–15 digits
        if (!/^\+?[0-9]{10,15}$/.test(String(value || '').replace(/[\s-]/g, ''))) {
          throw new Error('A valid phone number is required');
        }
      }
      return true;
    }),
];
router.post('/send-otp', otpLimiter, otpTargetValidation, handleValidationErrors, sendOtp);
router.post(
  '/verify-otp',
  otpLimiter,
  otpTargetValidation,
  body('code').isLength({ min: 4, max: 6 }).isNumeric().withMessage('code must be 4–6 digits'),
  handleValidationErrors,
  verifyOtp
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

// Change email (2-step, OTP-verified to the new address)
router.post('/change-email/request',
  auth,
  otpLimiter,
  changeEmailRequestValidation,
  handleValidationErrors,
  requestEmailChange
);
router.post('/change-email/verify',
  auth,
  otpLimiter,
  changeEmailVerifyValidation,
  handleValidationErrors,
  verifyEmailChange
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

// Delete account (soft-delete, requires password confirmation)
router.delete('/account',
  auth,
  [body('password').notEmpty().withMessage('Password is required')],
  handleValidationErrors,
  deleteAccount
);

module.exports = router;
