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
  acceptTerms,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  getSessions,
  getLoginHistory,
  scheduleAccountDeletion,
  cancelAccountDeletion,
  forgotPasswordPhone,
  resetPasswordPhone,
  revokeSession,
  deleteAccount,
  exportMyData,
  sendOtp,
  verifyOtp,
  checkReferralCode,
  googleAuth,
  requestEmailChange,
  verifyEmailChange,
  requestContactNumber,
  verifyContactNumber,
} = require('../controllers/authController');
const { getMfaStatus, setupMfa, enableMfa, disableMfa } = require('../controllers/mfaController');
const { auth } = require('../middlewares/auth');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const {
  authLimiter,
  refreshLimiter,
  otpLimiter,
  signupLimiter,
  passwordResetLimiter,
  passwordResetSubmitLimiter,
  sensitiveActionLimiter,
  checkAccountLockout,
  createRateLimiter
} = require('../middlewares/security');
const {
  signupValidation,
  loginValidation,
  changeEmailRequestValidation,
  changeEmailVerifyValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  phoneResetRequestValidation,
  phoneResetSubmitValidation,
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

// Refresh token - own budget, must never exhaust the login limiter
router.post('/refresh',
  refreshLimiter,
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

// Reset password - own budget so a mistyped password can't lock the user out mid-reset
router.post('/reset-password',
  passwordResetSubmitLimiter,
  resetPasswordValidation, 
  handleValidationErrors, 
  resetPassword
);

// Phone-OTP password reset: only for accounts with no verified email to receive
// a link (see the controller). Same budgets as the email flow.
router.post('/forgot-password/phone',
  passwordResetLimiter,
  phoneResetRequestValidation,
  handleValidationErrors,
  forgotPasswordPhone
);

router.post('/reset-password/phone',
  passwordResetSubmitLimiter,
  phoneResetSubmitValidation,
  handleValidationErrors,
  resetPasswordPhone
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
// Referral-code check for the signup form. Public, so it is a guessing surface
// for codes: IP-limited well below the general API limiter.
const referralCheckLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many referral code checks, please try again later',
});
router.post(
  '/referral-check',
  referralCheckLimiter,
  body('code').isString().trim().isLength({ min: 3, max: 32 }).withMessage('Enter a referral code'),
  handleValidationErrors,
  checkReferralCode
);
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
router.post('/accept-terms', auth, body('termsVersion').isString().isLength({ max: 32 }), handleValidationErrors, acceptTerms);

// Logout current session
router.post('/logout', auth, logout);

// Logout all sessions
router.post('/logout-all', auth, logoutAll);

// Change password
// Credential-changing endpoint: password guessing against `currentPassword`
// had only the global limiter in front of it.
router.post('/change-password', 
  auth,
  passwordResetSubmitLimiter,
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

// Contact number: verified once, then shown to members who unlock this profile.
// The request step skips the OTP entirely when the DB already holds this exact
// number as verified for the account.
router.post('/contact-number/request',
  auth,
  otpLimiter,
  body('phone').isString().isLength({ min: 10, max: 16 }),
  handleValidationErrors,
  requestContactNumber
);
router.post('/contact-number/verify',
  auth,
  otpLimiter,
  body('phone').isString().isLength({ min: 10, max: 16 }),
  body('code').optional().isLength({ min: 4, max: 6 }).isNumeric(),
  handleValidationErrors,
  verifyContactNumber
);

// Get active sessions
router.get('/sessions', auth, getSessions);

// Recent sign-ins (audit P2: login history)
router.get('/login-history', auth, getLoginHistory);

// Revoke a specific session
router.delete('/sessions/:sessionId',
  auth,
  [param('sessionId').isUUID(4).withMessage('Invalid session ID')],
  handleValidationErrors,
  revokeSession
);

// Delete after a grace period (cancellable). Same re-authentication as the
// immediate delete below.
router.post('/account/schedule-deletion',
  auth,
  sensitiveActionLimiter,
  [
    body('password').optional().isString().isLength({ max: 200 }),
    body('googleCredential').optional().isString().isLength({ max: 4096 }),
    body().custom((value) => {
      if (!value || (!value.password && !value.googleCredential)) {
        throw new Error('Password is required');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  scheduleAccountDeletion
);

router.post('/account/cancel-deletion', auth, sensitiveActionLimiter, cancelAccountDeletion);

// Delete account (soft-delete, requires password confirmation)
router.delete('/account',
  auth,
  // Compares a password on every call. Without a dedicated limiter the only
  // bound was apiLimiter's 900-per-15-minutes-per-user budget.
  sensitiveActionLimiter,
  [
    // Password members send `password`; Google-only members (no password) send a
    // fresh `googleCredential` instead. The controller decides which applies.
    body('password').optional().isString().isLength({ max: 200 }),
    body('googleCredential').optional().isString().isLength({ max: 4096 }),
    body().custom((value) => {
      if (!value || (!value.password && !value.googleCredential)) {
        throw new Error('Password is required');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  deleteAccount
);

// Download everything we hold about the member. Re-authenticates like account
// deletion (a stolen session must not be able to walk off with the whole file),
// and shares its limiter: it assembles ~17 queries per call.
router.post('/me/export',
  auth,
  sensitiveActionLimiter,
  [
    body('password').optional().isString().isLength({ max: 200 }),
    body('googleCredential').optional().isString().isLength({ max: 4096 }),
    body().custom((value) => {
      if (!value || (!value.password && !value.googleCredential)) throw new Error('Password is required');
      return true;
    }),
  ],
  handleValidationErrors,
  exportMyData
);

// ==================== TWO-STEP VERIFICATION ====================
router.get('/mfa/status', auth, getMfaStatus);
router.post('/mfa/setup', auth, sensitiveActionLimiter,
  body('password').isString().isLength({ min: 1, max: 100 }).withMessage('Password is required'),
  handleValidationErrors, setupMfa);
router.post('/mfa/enable', auth, sensitiveActionLimiter,
  body('code').isString().isLength({ min: 6, max: 7 }).withMessage('Enter the 6-digit code'),
  handleValidationErrors, enableMfa);
router.post('/mfa/disable', auth, sensitiveActionLimiter,
  body('password').isString().isLength({ min: 1, max: 100 }).withMessage('Password is required'),
  body('code').isString().isLength({ min: 6, max: 20 }).withMessage('Enter a code'),
  handleValidationErrors, disableMfa);

module.exports = router;
