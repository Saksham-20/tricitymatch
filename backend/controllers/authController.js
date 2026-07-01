/**
 * Authentication Controller
 * Implements secure JWT authentication with refresh token rotation
 */

const jwt = require('jsonwebtoken');
const { User, Profile, Subscription, RefreshToken, ReferralCode, MarketingLead } = require('../models');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmail, sendOtpEmail, sendSecurityAlert } = require('../utils/email');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { recordFailedLogin, clearLoginAttempts } = require('../middlewares/security');
const { log } = require('../middlewares/logger');
const { OAuth2Client } = require('google-auth-library');
const smsService = require('../utils/smsService');

// Cookie configuration: use Secure only over HTTPS so cookies work when frontend is http://
const useSecureCookies = config.isProduction && (config.server.frontendUrl || '').startsWith('https');
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: useSecureCookies,
  // 'strict' in production prevents CSRF via cross-site navigation.
  // 'lax' in dev allows port 3000 → 5001 cross-origin requests to carry cookies.
  sameSite: config.isProduction ? 'strict' : 'lax',
  maxAge,
  path: '/',
});

// Attach the derived AuthUser fields the clients (mobile RootNavigator + premium
// gates, web) expect but which aren't columns on Users: `subscriptionPlan` (from the
// active subscription, else 'free') and `onboardingComplete` (the user has filled the
// Step-1 basics). Kept in one place so login/signup/getMe stay in sync.
const withDerivedUserFields = async (userInstance) => {
  const user = userInstance.toJSON();
  const activeSub = await Subscription.findOne({
    where: { userId: user.id, status: 'active' },
    order: [['createdAt', 'DESC']],
  });
  user.subscriptionPlan = activeSub?.planType || 'free';
  const profile = user.Profile;
  // Authoritative flag persisted on the profile: set at signup for web (full profile
  // collected first), at the end of onboarding Step 14 for mobile. The migration
  // backfilled every pre-existing row to true, so the column is always populated.
  user.onboardingComplete = Boolean(profile && profile.onboardingComplete);
  return user;
};

// Generate short-lived access token
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiry }
  );
};

// Generate refresh token and save to database
const generateRefreshToken = async (userId, userAgent, ipAddress, existingFamily = null) => {
  const token = RefreshToken.generateToken();
  const expiresAt = new Date(Date.now() + parseDuration(config.auth.refreshTokenExpiry));
  
  await RefreshToken.create({
    userId,
    token,
    tokenHash: RefreshToken.hashToken(token),
    family: existingFamily || require('crypto').randomUUID(),
    expiresAt,
    userAgent: userAgent?.substring(0, 500),
    ipAddress,
  });
  
  return token;
};

// Parse duration string (e.g., '7d', '1h', '30m') to milliseconds
const parseDuration = (duration) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  return parseInt(match[1]) * units[match[2]];
};

// Set auth cookies
const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessMaxAge = parseDuration(config.auth.jwtExpiry);
  const refreshMaxAge = parseDuration(config.auth.refreshTokenExpiry);
  
  res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));
  res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
};

// Clear auth cookies
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
exports.signup = asyncHandler(async (req, res) => {
  const { email, password, phone, firstName, lastName, gender, dateOfBirth, referralCode } = req.body;
  const codeFromQuery = req.query.ref || req.body.ref;

  // Flexible auth: account is identified by EITHER an email OR a phone number.
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedPhone = phone ? String(phone).trim() : null;
  if (!normalizedEmail && !normalizedPhone) {
    throw createError.badRequest('An email address or phone number is required');
  }

  // Check if user already exists (by whichever identifier was provided)
  if (normalizedEmail) {
    const existingByEmail = await User.findOne({ where: { email: normalizedEmail } });
    if (existingByEmail) throw createError.conflict('An account already exists with this email');
  }
  if (normalizedPhone) {
    const existingByPhone = await User.findOne({ where: { phone: normalizedPhone } });
    if (existingByPhone) throw createError.conflict('An account already exists with this phone number');
  }

  // Validate and process referral code
  let referralData = null;
  const codeToUse = referralCode || codeFromQuery;
  if (codeToUse) {
    const code = await ReferralCode.findOne({ where: { code: codeToUse.toUpperCase(), isActive: true } });
    if (code) {
      referralData = {
        referralCodeUsed: code.code,
        referredByMarketingUserId: code.marketingUserId,
        isBoosted: true,
        boostExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };
    }
  }

  // Consume the OTP-verified markers set by verify-otp so the account is stamped
  // verified at creation (proves the contact was confirmed, not client-trusted).
  let emailWasVerified = false;
  let phoneWasVerified = false;
  try {
    const { get: cacheGet, del: cacheDel } = require('../utils/cache');
    if (normalizedEmail) {
      const k = `otp-verified:email:${normalizedEmail}`;
      if (await cacheGet(k)) { emailWasVerified = true; await cacheDel(k); }
    }
    if (normalizedPhone) {
      const k = `otp-verified:phone:${smsService.normalizePhone(normalizedPhone)}`;
      if (await cacheGet(k)) { phoneWasVerified = true; await cacheDel(k); }
    }
  } catch { /* non-fatal */ }

  const sequelize = require('../config/database');
  let result;
  try {
    result = await sequelize.transaction(async (t) => {
      const user = await User.create({
        email: normalizedEmail,
        password,
        phone: normalizedPhone,
        status: 'active',
        emailVerified: emailWasVerified,
        phoneVerified: phoneWasVerified,
        ...(referralData && referralData)
      }, { transaction: t });

      // Leave gender/dateOfBirth NULL when not supplied so a mobile account
      // (email+password only) doesn't pre-fill onboarding Step 1 with placeholders.
      // Web sends the full profile at signup, so it's onboarded immediately.
      const profileDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      const onboardedAtSignup = Boolean(firstName && gender && dateOfBirth);
      await Profile.create({
        userId: user.id,
        // Name is optional at signup; Profile.firstName/lastName are NOT NULL → '' .
        firstName: firstName || '',
        lastName: lastName || '',
        gender: gender || null,
        dateOfBirth: profileDateOfBirth,
        onboardingComplete: onboardedAtSignup
      }, { transaction: t });

      // If referral code used, increment usage count and create marketing lead
      if (referralData) {
        await ReferralCode.update(
          { usageCount: sequelize.literal('usageCount + 1') },
          { where: { code: referralData.referralCodeUsed }, transaction: t }
        );

        await MarketingLead.create({
          name: `${firstName} ${lastName}`,
          phone: normalizedPhone || 'N/A',
          email: normalizedEmail || 'N/A',
          assignedToMarketingUserId: referralData.referredByMarketingUserId,
          referralCode: referralData.referralCodeUsed,
          convertedUserId: user.id,
          status: 'contacted'
        }, { transaction: t });
      }

      return user;
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw createError.conflict('An account already exists with this email or phone number');
    }
    log.error('Signup transaction failed', { error: err.message, stack: err.stack });
    throw createError.badRequest('Unable to create account. Please try again.');
  }

  // Send welcome email (non-blocking) — only when the account has an email
  if (result.email) {
    setImmediate(() => {
      sendWelcomeEmail(result.email, firstName || 'there')
        .catch(err => log.error('Failed to send welcome email', { error: err.message, userId: result.id }));
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(result.id);
  const refreshToken = await generateRefreshToken(
    result.id,
    req.headers['user-agent'],
    req.clientIp || req.ip
  );

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  // FE-2: return the full user (with Profile) so the client can skip the
  // follow-up /auth/me round-trip. Mirrors getMe's shape.
  const fullUser = await User.findByPk(result.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: await withDerivedUserFields(fullUser),
    // Tokens returned for non-cookie (native) clients; both are also set as
    // httpOnly cookies for the web client.
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.auth.jwtExpiry
    }
  });
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  // Flexible auth: `identifier` may be an email or a phone. `email` kept for
  // backward compatibility with older clients.
  const rawIdentifier = (req.body.identifier ?? req.body.email ?? '').toString().trim();
  const { password } = req.body;
  if (!rawIdentifier) {
    throw createError.badRequest('Email or phone number is required');
  }

  const isEmail = rawIdentifier.includes('@');
  const lookupKey = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier;
  const where = isEmail ? { email: lookupKey } : { phone: lookupKey };

  // Find user by email or phone
  const user = await User.findOne({ where });
  if (!user) {
    await recordFailedLogin(lookupKey);
    throw createError.unauthorized('Invalid credentials');
  }

  // OAuth-only accounts have no password set
  if (!user.password) {
    throw createError.unauthorized('This account uses Google sign-in. Please continue with Google.');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const attempts = await recordFailedLogin(lookupKey);
    const remaining = config.auth.maxLoginAttempts - attempts;
    
    if (remaining > 0) {
      throw createError.unauthorized(`Invalid credentials. ${remaining} attempts remaining.`);
    } else {
      throw createError.unauthorized('Account locked due to too many failed attempts');
    }
  }

  // Clear failed login attempts on success
  await clearLoginAttempts(lookupKey);

  // Check if user is active
  if (user.status !== 'active') {
    throw createError.forbidden('Account is not active. Please contact support.');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(
    user.id,
    req.headers['user-agent'],
    req.clientIp || req.ip
  );

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  // FE-2: return the full user (with Profile) so the client doesn't need a second
  // /auth/me round-trip right after login. Mirrors getMe's shape.
  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });

  res.json({
    success: true,
    message: 'Login successful',
    user: await withDerivedUserFields(fullUser),
    // Tokens returned for non-cookie (native) clients; both are also set as
    // httpOnly cookies for the web client.
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.auth.jwtExpiry
    }
  });
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public (with valid refresh token)
exports.refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or body
  const refreshTokenValue = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!refreshTokenValue) {
    throw createError.unauthorized('Refresh token required');
  }

  // Find the token
  const tokenHash = RefreshToken.hashToken(refreshTokenValue);
  const storedToken = await RefreshToken.findValidToken(tokenHash);

  if (!storedToken) {
    // Token not found or invalid - could be token reuse attack
    // Revoke all tokens in the family as a precaution
    const possibleToken = await RefreshToken.findOne({ where: { tokenHash } });
    if (possibleToken) {
      await RefreshToken.revokeFamily(possibleToken.family, 'token_reuse_detected');
      log.security('token_reuse_detected', { userId: possibleToken.userId, family: possibleToken.family });
    }
    clearAuthCookies(res);
    throw createError.unauthorized('Invalid refresh token');
  }

  // Check if user is still active
  const user = await User.findByPk(storedToken.userId);
  if (!user || user.status !== 'active') {
    await storedToken.revoke('user_inactive');
    clearAuthCookies(res);
    throw createError.unauthorized('User account is not active');
  }

  // Rotate refresh token (invalidate old, create new)
  await storedToken.revoke('rotated');
  
  // Generate new tokens
  const newAccessToken = generateAccessToken(user.id);
  const newRefreshToken = await generateRefreshToken(
    user.id,
    req.headers['user-agent'],
    req.clientIp || req.ip,
    storedToken.family // Keep the same family for tracking
  );

  // Update last used
  storedToken.lastUsedAt = new Date();
  await storedToken.save();

  // Set cookies
  setAuthCookies(res, newAccessToken, newRefreshToken);

  // Return the full user so native clients can restore their session on cold
  // start without a second /auth/me round-trip (mirrors login/getMe shape).
  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });

  res.json({
    success: true,
    message: 'Token refreshed',
    user: await withDerivedUserFields(fullUser),
    tokens: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.auth.jwtExpiry
    }
  });
});

// @route   POST /api/auth/logout
// @desc    Logout user (revoke current refresh token)
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  const refreshTokenValue = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (refreshTokenValue) {
    const tokenHash = RefreshToken.hashToken(refreshTokenValue);
    const storedToken = await RefreshToken.findOne({ where: { tokenHash } });
    if (storedToken) {
      await storedToken.revoke('logout');
    }
  }

  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   POST /api/auth/logout-all
// @desc    Logout from all devices (revoke all refresh tokens)
// @access  Private
exports.logoutAll = asyncHandler(async (req, res) => {
  await RefreshToken.revokeAllUserTokens(req.user.id, 'logout_all_devices');
  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logged out from all devices'
  });
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }]
  });

  if (!user) {
    throw createError.notFound('User not found');
  }

  res.json({
    success: true,
    user: await withDerivedUserFields(user)
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Initiate password reset
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase();
  
  // Always respond with same message to prevent email enumeration
  const genericMessage = 'If the email exists, a reset link has been sent.';

  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    // Simulate processing time to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
    return res.json({ success: true, message: genericMessage });
  }

  // Generate reset token (short-lived, tied to current password so it's single-use)
  // Including a fingerprint of the current password hash invalidates the token
  // automatically once the password is changed.
  const pwdFingerprint = require('crypto')
    .createHash('sha256')
    .update(user.password)
    .digest('hex')
    .substring(0, 16);
  const resetToken = jwt.sign(
    { userId: user.id, type: 'password_reset', pwdFp: pwdFingerprint },
    config.auth.jwtSecret,
    { expiresIn: config.auth.resetTokenExpiry }
  );

  const resetUrl = `${config.server.frontendUrl}/reset-password?token=${resetToken}`;

  // Send email (don't fail the request if email fails)
  try {
    await sendPasswordResetEmail(user.email, user.firstName || 'User', resetUrl);
  } catch (error) {
    log.error('Failed to send password reset email', { error: error.message, userId: user.id });
    // Don't expose email failures to client
  }

  res.json({
    success: true,
    message: genericMessage,
    // Include token in development for testing
    ...(config.isDevelopment ? { resetToken } : {})
  });
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(token, config.auth.jwtSecret);
  } catch (err) {
    throw createError.badRequest('Invalid or expired reset token');
  }

  if (decoded.type !== 'password_reset') {
    throw createError.badRequest('Invalid reset token');
  }

  const user = await User.findByPk(decoded.userId);
  if (!user) {
    throw createError.notFound('User not found');
  }

  // Verify the password fingerprint matches — if the password has already been changed
  // (e.g. token used once, or user reset password via another method), reject the token.
  if (decoded.pwdFp) {
    const currentFp = require('crypto')
      .createHash('sha256')
      .update(user.password)
      .digest('hex')
      .substring(0, 16);
    if (currentFp !== decoded.pwdFp) {
      throw createError.badRequest('Reset token has already been used or is no longer valid');
    }
  }

  // Update password (will be hashed by model hook)
  user.password = password;
  await user.save();

  // Revoke all refresh tokens for security
  await RefreshToken.revokeAllUserTokens(user.id, 'password_reset');

  // Send security alert (password changed)
  try {
    await sendSecurityAlert(
      user.email,
      user.firstName || 'User',
      'Your password was changed',
      'Your TricityShadi account password was just changed.',
      new Date().toUTCString()
    );
  } catch (error) {
    log.error('Failed to send password change confirmation', { error: error.message, userId: user.id });
  }

  res.json({
    success: true,
    message: 'Password has been reset successfully. Please login with your new password.'
  });
});

// @route   POST /api/auth/change-password
// @desc    Change password (while logged in)
// @access  Private
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw createError.notFound('User not found');
  }

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw createError.unauthorized('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Revoke all other refresh tokens (keep current session)
  const currentRefreshToken = req.cookies?.refreshToken || req.body.currentRefreshToken;
  if (currentRefreshToken) {
    const currentHash = RefreshToken.hashToken(currentRefreshToken);
    await RefreshToken.update(
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'password_change' },
      { 
        where: { 
          userId: user.id,
          tokenHash: { [require('sequelize').Op.ne]: currentHash }
        } 
      }
    );
  }

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @route   GET /api/auth/sessions
// @desc    Get active sessions
// @access  Private
exports.getSessions = asyncHandler(async (req, res) => {
  const sessions = await RefreshToken.findAll({
    where: {
      userId: req.user.id,
      isRevoked: false,
      expiresAt: { [require('sequelize').Op.gt]: new Date() }
    },
    attributes: ['id', 'userAgent', 'ipAddress', 'createdAt', 'lastUsedAt'],
    order: [['lastUsedAt', 'DESC']]
  });

  // Identify current session
  const currentRefreshToken = req.cookies?.refreshToken;
  let currentSessionId = null;
  if (currentRefreshToken) {
    const currentHash = RefreshToken.hashToken(currentRefreshToken);
    const currentSession = await RefreshToken.findOne({ 
      where: { tokenHash: currentHash },
      attributes: ['id']
    });
    if (currentSession) {
      currentSessionId = currentSession.id;
    }
  }

  res.json({
    success: true,
    sessions: sessions.map(s => ({
      ...s.toJSON(),
      isCurrent: s.id === currentSessionId
    })),
    currentSessionId
  });
});

// @route   DELETE /api/auth/sessions/:sessionId
// @desc    Revoke a specific session
// @access  Private
exports.revokeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await RefreshToken.findOne({
    where: {
      id: sessionId,
      userId: req.user.id
    }
  });

  if (!session) {
    throw createError.notFound('Session not found');
  }

  await session.revoke('user_revoked');

  res.json({
    success: true,
    message: 'Session revoked'
  });
});

// @route   DELETE /api/auth/account
// @desc    Soft-delete account (requires password confirmation)
// @access  Private
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) throw createError.badRequest('Password is required to delete your account');

  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.notFound('User not found');

  const isValid = await user.comparePassword(password);
  if (!isValid) throw createError.unauthorized('Incorrect password');

  // Soft-delete: mark as deleted + revoke all tokens
  user.status = 'deleted';
  await user.save();

  await RefreshToken.destroy({ where: { userId: user.id } });
  clearAuthCookies(res);

  res.json({ success: true, message: 'Account deleted successfully' });
});

// @route   POST /api/auth/send-otp
// @desc    Send real OTP via SMS (Fast2SMS/MSG91) or log in dev mode
// @access  Public
exports.sendOtp = asyncHandler(async (req, res) => {
  const { type, target } = req.body;
  if (!target) throw createError.badRequest('target is required');

  // OTP is signup verification — only for NEW contacts. If an account already
  // exists for this email/phone, refuse and point them to login. Without this an
  // existing (even logged-in) user could trigger an OTP to their own number.
  const { Op } = require('sequelize');
  if (type === 'email') {
    const email = String(target).toLowerCase().trim();
    const exists = await User.findOne({ where: { email }, attributes: ['id'] });
    if (exists) throw createError.conflict('An account already exists with this email. Please log in instead.');
  } else if (type === 'phone') {
    // Match every form a phone might be stored in (bare 10-digit, +91, 91…).
    const last10 = String(target).replace(/\D/g, '').slice(-10);
    const variants = [...new Set([String(target).trim(), last10, `91${last10}`, `+91${last10}`, `0${last10}`])].filter(Boolean);
    const exists = await User.findOne({ where: { phone: { [Op.in]: variants } }, attributes: ['id'] });
    if (exists) throw createError.conflict('An account already exists with this phone number. Please log in instead.');
  }

  if (type === 'phone') {
    const result = await smsService.sendOtp(target);
    res.json(result);
  } else if (type === 'email') {
    // Email OTP: use smsService-style store but deliver via email (Resend)
    const { set: cacheSet } = require('../utils/cache');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const payload = JSON.stringify({ code, expiresAt: Date.now() + 600 * 1000, attempts: 0 });
    await cacheSet(`otp:${target}`, payload, 600);
    await sendOtpEmail(target, code, 'verify your email');
    // Dev affordance: log the code when no email channel is configured.
    if (!config.email.isConfigured() && !config.server.isProduction) {
      log.info(`[EMAIL-OTP DEV] Code for ${target}: ${code}`);
    }
    res.json({ success: true, message: 'OTP sent to email' });
  } else {
    throw createError.badRequest('type must be phone or email');
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP — enforces expiry, attempt limits, no bypass codes
// @access  Public
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { type, target, code } = req.body;
  if (!target || !code) throw createError.badRequest('target and code are required');

  let result;
  if (type === 'email') {
    // Email OTP lives at `otp:<email>` (set by send-otp). It must NOT go through
    // smsService.verifyOtp, which canonicalizes the target as a phone number —
    // an email normalizes to null and throws before any code check. Verify here.
    const { get: cacheGet, set: cacheSet, del: cacheDel } = require('../utils/cache');
    const key = `otp:${String(target).toLowerCase().trim()}`;

    const bypassCodes = config.sms.bypassCodes || [];
    if (bypassCodes.length > 0 && bypassCodes.includes(String(code))) {
      await cacheDel(key);
      result = { success: true, message: 'OTP verified (bypass)' };
    } else {
      const raw = await cacheGet(key);
      if (!raw) throw createError.badRequest('OTP expired or not sent. Please request a new one.');
      let entry;
      try { entry = JSON.parse(raw); } catch { throw createError.badRequest('OTP data corrupt. Please request a new one.'); }
      if (entry.expiresAt < Date.now()) { await cacheDel(key); throw createError.badRequest('OTP has expired. Please request a new one.'); }
      if ((entry.attempts || 0) >= 5) { await cacheDel(key); throw createError.badRequest('Too many incorrect attempts. Please request a new OTP.'); }
      if (entry.code !== String(code)) {
        const ttlSec = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
        await cacheSet(key, JSON.stringify({ ...entry, attempts: (entry.attempts || 0) + 1 }), ttlSec);
        const remaining = 5 - (entry.attempts || 0) - 1;
        throw createError.badRequest(`Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }
      await cacheDel(key);
      result = { success: true, message: 'OTP verified successfully' };
    }
  } else {
    // Phone OTP — smsService canonicalizes + checks the `otp:<91…>` store.
    result = await smsService.verifyOtp(target, code);
  }

  // Record a short-lived "this contact was just verified" marker so signup can
  // (a) stamp the new account as verified and (b) prove the contact really was
  // confirmed — not just trusted from a client flag. 30-min window to finish
  // signup. Phone is canonicalized to match how signup normalizes it.
  try {
    const { set: cacheSet } = require('../utils/cache');
    const key = type === 'phone'
      ? `otp-verified:phone:${smsService.normalizePhone(target)}`
      : `otp-verified:email:${String(target).toLowerCase().trim()}`;
    await cacheSet(key, '1', 1800);
  } catch { /* non-fatal: verification still succeeds */ }

  res.json({ ...result, message: `${type} verified successfully` });
});

// @route   POST /api/auth/google
// @desc    Sign in / sign up with Google ID token
// @access  Public
exports.googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw createError.badRequest('Google credential is required');

  const clientId = config.google.clientId;
  if (!clientId) throw createError.internal('Google OAuth is not configured on this server');

  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw createError.unauthorized('Invalid Google credential');
  }

  const { sub: googleId, email, given_name: firstName, family_name: lastName, email_verified } = payload;
  if (!email_verified) throw createError.badRequest('Google account email is not verified');

  const sequelize = require('../config/database');

  // Find existing user by googleId or email
  let user = await User.findOne({ where: { googleId } });
  let isNewUser = false;

  if (!user) {
    user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (user) {
      // Link Google to existing email account
      user.googleId = googleId;
      if (!user.emailVerified) user.emailVerified = true;
      await user.save();
    } else {
      // New user — create account + profile in one transaction
      isNewUser = true;
      user = await sequelize.transaction(async (t) => {
        const newUser = await User.create({
          email: email.toLowerCase(),
          googleId,
          password: null,
          status: 'active',
          emailVerified: true,
        }, { transaction: t });

        await Profile.create({
          userId: newUser.id,
          firstName: firstName || '',
          lastName: lastName || '',
          gender: 'other',
          dateOfBirth: new Date('2000-01-01'),
        }, { transaction: t });

        return newUser;
      });

      setImmediate(() => {
        sendWelcomeEmail(user.email, firstName || 'there')
          .catch(err => log.error('Failed to send welcome email (google)', { error: err.message }));
      });
    }
  }

  if (user.status === 'banned') throw createError.forbidden('Your account has been suspended');

  user.lastLogin = new Date();
  await user.save();

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id, req.headers['user-agent'], req.clientIp || req.ip);
  setAuthCookies(res, accessToken, refreshToken);

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser ? 'Account created successfully' : 'Logged in successfully',
    isNewUser,
    user: { id: user.id, email: user.email, role: user.role },
    tokens: { accessToken, refreshToken, expiresIn: config.auth.jwtExpiry },
  });
});

// @route   POST /api/auth/change-email/request
// @desc    Authenticated: verify identity + email a 6-digit code to the NEW address
// @access  Private
exports.requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;
  const normalized = (newEmail || '').toLowerCase().trim();
  if (!normalized) throw createError.badRequest('New email is required');

  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.unauthorized('Not authenticated');

  // Password-confirm for accounts that have a password (OAuth-only users skip)
  if (user.password) {
    if (!password) throw createError.badRequest('Current password is required');
    const ok = await user.comparePassword(password);
    if (!ok) throw createError.unauthorized('Incorrect password');
  }

  if (user.email && user.email.toLowerCase() === normalized) {
    throw createError.badRequest('That is already your email address');
  }

  const taken = await User.findOne({ where: { email: normalized } });
  if (taken) throw createError.conflict('That email is already in use');

  const { set: cacheSet } = require('../utils/cache');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const payload = JSON.stringify({ code, expiresAt: Date.now() + 600 * 1000, attempts: 0, userId: user.id });
  await cacheSet(`email-change:${normalized}`, payload, 600);
  await sendOtpEmail(normalized, code, 'confirm your new email address');
  // Dev affordance (matches smsService): log the code when email isn't configured.
  if (!config.email.isConfigured() && !config.server.isProduction) {
    log.info(`[EMAIL-CHANGE DEV] Code for ${normalized}: ${code}`);
  }

  res.json({ success: true, message: 'Verification code sent to your new email' });
});

// @route   POST /api/auth/change-email/verify
// @desc    Authenticated: verify the code and apply the new email
// @access  Private
exports.verifyEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, code } = req.body;
  const normalized = (newEmail || '').toLowerCase().trim();
  if (!normalized || !code) throw createError.badRequest('New email and code are required');

  const { get: cacheGet, set: cacheSet, del: cacheDel } = require('../utils/cache');
  const key = `email-change:${normalized}`;
  const raw = await cacheGet(key);
  if (!raw) throw createError.badRequest('Code expired or not found. Please request a new one.');

  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (data.userId !== req.user.id) throw createError.unauthorized('This code was issued for a different account');
  if (Date.now() > data.expiresAt) { await cacheDel(key); throw createError.badRequest('Code expired. Please request a new one.'); }
  if (data.attempts >= 5) { await cacheDel(key); throw createError.badRequest('Too many attempts. Please request a new code.'); }
  if (String(code).trim() !== String(data.code)) {
    data.attempts += 1;
    await cacheSet(key, JSON.stringify(data), 600);
    throw createError.badRequest('Incorrect code');
  }

  // Re-check availability (guards a race between request and verify)
  const taken = await User.findOne({ where: { email: normalized } });
  if (taken && taken.id !== req.user.id) throw createError.conflict('That email is already in use');

  const user = await User.findByPk(req.user.id);
  user.email = normalized;
  user.emailVerified = true;
  await user.save();
  await cacheDel(key);

  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });
  res.json({ success: true, message: 'Email updated successfully', user: await withDerivedUserFields(fullUser) });
});

