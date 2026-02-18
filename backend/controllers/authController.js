/**
 * Authentication Controller
 * Implements secure JWT authentication with refresh token rotation
 */

const jwt = require('jsonwebtoken');
const { User, Profile, RefreshToken } = require('../models');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmail } = require('../utils/email');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { recordFailedLogin, clearLoginAttempts } = require('../middlewares/security');
const { log } = require('../middlewares/logger');

// Cookie configuration
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? 'strict' : 'lax',
  maxAge,
  path: '/',
});

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
  const { email, password, phone, firstName, lastName, gender, dateOfBirth } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    throw createError.conflict('User already exists with this email');
  }

  const sequelize = require('../config/database');
  let result;
  try {
    result = await sequelize.transaction(async (t) => {
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        phone: phone || null,
        status: 'active'
      }, { transaction: t });

      const profileDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : new Date('2000-01-01');
      await Profile.create({
        userId: user.id,
        firstName,
        lastName,
        gender: gender || 'other',
        dateOfBirth: profileDateOfBirth
      }, { transaction: t });

      return user;
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw createError.conflict('User already exists with this email');
    }
    log('error', 'Signup transaction failed', { error: err.message, stack: err.stack });
    throw createError.badRequest('Unable to create account. Please try again.');
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

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: {
      id: result.id,
      email: result.email,
      role: result.role
    },
    // Also return tokens in body for clients that can't use cookies
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
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  // Find user
  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    recordFailedLogin(normalizedEmail);
    throw createError.unauthorized('Invalid credentials');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const attempts = recordFailedLogin(normalizedEmail);
    const remaining = config.auth.maxLoginAttempts - attempts;
    
    if (remaining > 0) {
      throw createError.unauthorized(`Invalid credentials. ${remaining} attempts remaining.`);
    } else {
      throw createError.unauthorized('Account locked due to too many failed attempts');
    }
  }

  // Clear failed login attempts on success
  clearLoginAttempts(normalizedEmail);

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

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    },
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
      console.warn(`Potential token reuse attack detected for user ${possibleToken.userId}`);
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

  res.json({
    success: true,
    message: 'Token refreshed',
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
    user
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

  // Generate reset token (short-lived)
  const resetToken = jwt.sign(
    { userId: user.id, type: 'password_reset' },
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

  // Update password (will be hashed by model hook)
  user.password = password;
  await user.save();

  // Revoke all refresh tokens for security
  await RefreshToken.revokeAllUserTokens(user.id, 'password_reset');

  // Send confirmation email
  try {
    await sendEmail(user.email, {
      subject: 'Password Changed - TricityMatch',
      html: `
        <p>Hi ${user.firstName || 'User'},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you didn't make this change, please contact support immediately.</p>
      `,
      text: 'Your password has been changed. If you didn\'t make this change, contact support immediately.'
    });
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
