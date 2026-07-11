/**
 * Authentication Middleware
 * Handles JWT verification, user loading, and authorization
 */

const jwt = require('jsonwebtoken');
const { User, Subscription, RefreshToken } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/env');
const { createError, asyncHandler } = require('./errorHandler');
const { PAID_PLANS, UNLIMITED_PLANS } = require('../constants/plans');

/**
 * Extract token from request
 * Priority: Authorization header > Cookie. (No query-param fallback — see SEC-1.)
 */
const extractToken = (req) => {
  // Check Authorization header
  const authHeader = req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  // NOTE: query-param tokens are intentionally NOT accepted on REST routes (SEC-1).
  // Tokens in URLs leak into access/proxy logs, browser history and the Referer
  // header. The Socket.io handshake uses its own token source (handshake.auth.token
  // in socketHandler.js / socketAuth), not this function.

  return null;
};

/**
 * Main authentication middleware
 * Verifies JWT and attaches user to request
 */
const auth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw createError.unauthorized('Authentication required');
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);

    // Verify token type
    if (decoded.type !== 'access') {
      throw createError.unauthorized('Invalid token type');
    }

    // Load user (minimal data for performance)
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'role', 'status']
    });

    if (!user) {
      throw createError.unauthorized('User not found');
    }

    if (user.status !== 'active') {
      throw createError.forbidden('Account is not active');
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw createError.unauthorized('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw createError.unauthorized('Invalid token');
    }
    throw error;
  }
});

/**
 * Optional authentication middleware
 * Doesn't require auth but attaches user if token is present
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);

    if (decoded.type === 'access') {
      const user = await User.findByPk(decoded.userId, {
        attributes: ['id', 'email', 'role', 'status']
      });

      if (user && user.status === 'active') {
        req.user = user;
        req.userId = user.id;
      }
    }
  } catch (error) {
    // Token invalid, continue without auth
  }

  next();
});

/**
 * Admin authorization middleware
 * Must be used after auth middleware
 */
const adminAuth = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw createError.unauthorized('Authentication required');
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createError.forbidden('Admin access required');
  }

  next();
});

/**
 * Marketing authorization middleware
 * Must be used after auth middleware
 * Allows marketing, marketing_manager, admin, and super_admin roles
 */
const marketingAuth = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw createError.unauthorized('Authentication required');
  }

  const allowedRoles = ['marketing', 'marketing_manager', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    throw createError.forbidden('Marketing access required');
  }

  next();
});

/**
 * Premium subscription requirement middleware
 * Must be used after auth middleware
 */
const requirePremium = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  const subscription = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      [Op.or]: [
        { endDate: null },
        { endDate: { [Op.gt]: new Date() } }
      ]
    }
  });

  if (!subscription) {
    throw createError.forbidden('Premium subscription required', 'PREMIUM_REQUIRED');
  }

  // Check if subscription has expired
  if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
    subscription.status = 'expired';
    await subscription.save();
    throw createError.forbidden('Your subscription has expired', 'SUBSCRIPTION_EXPIRED');
  }

  // Attach subscription to request
  req.subscription = subscription;
  next();
});

/**
 * VIP subscription requirement middleware
 */
const requireVIP = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  const subscription = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: UNLIMITED_PLANS },
      [Op.or]: [
        { endDate: null },
        { endDate: { [Op.gt]: new Date() } }
      ]
    }
  });

  if (!subscription) {
    throw createError.forbidden('VIP subscription required', 'VIP_REQUIRED');
  }

  req.subscription = subscription;
  next();
});

/**
 * Check contact unlock limit middleware
 * Must be used after requirePremium middleware (req.subscription must exist)
 */
const checkContactUnlockLimit = asyncHandler(async (req, res, next) => {
  const subscription = req.subscription;

  if (!subscription) {
    throw createError.forbidden('Premium subscription required', 'PREMIUM_REQUIRED');
  }

  // NULL contactUnlocksAllowed = unlimited unlocks
  if (subscription.contactUnlocksAllowed === null) {
    return next();
  }

  // Check if user has remaining unlocks
  if (subscription.contactUnlocksUsed >= subscription.contactUnlocksAllowed) {
    throw createError.forbidden(
      `You have used all ${subscription.contactUnlocksAllowed} contact unlocks for your plan. Upgrade to unlock more.`,
      'CONTACT_UNLOCK_LIMIT_REACHED'
    );
  }

  next();
});

/**
 * Verify user exists and is active
 * Used to verify target users in operations like matching, messaging
 */
const verifyTargetUser = (paramName = 'userId') => {
  return asyncHandler(async (req, res, next) => {
    const targetUserId = req.params[paramName] || req.body[paramName] || req.body.receiverId;
    
    if (!targetUserId) {
      throw createError.badRequest('Target user ID is required');
    }

    // Prevent self-targeting for certain operations
    if (targetUserId === req.user?.id) {
      throw createError.badRequest('Cannot perform this action on yourself');
    }

    const targetUser = await User.findByPk(targetUserId, {
      attributes: ['id', 'status']
    });

    if (!targetUser) {
      throw createError.notFound('User not found');
    }

    if (targetUser.status !== 'active') {
      throw createError.badRequest('User is not available');
    }

    req.targetUser = targetUser;
    next();
  });
};

/**
 * Socket.io authentication middleware
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret);

    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'role', 'status']
    });

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    socket.userId = user.id;
    socket.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    return next(new Error('Invalid token'));
  }
};

/**
 * Socket.io premium subscription check
 */
const socketRequirePremium = async (socket, next) => {
  try {
    const subscription = await Subscription.findOne({
      where: {
        userId: socket.userId,
        status: 'active',
        planType: { [Op.in]: PAID_PLANS },
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gt]: new Date() } }
        ]
      }
    });

    if (!subscription) {
      socket.emit('error', { 
        code: 'PREMIUM_REQUIRED',
        message: 'Premium subscription required for chat'
      });
      return socket.disconnect(true);
    }

    socket.subscription = subscription;
    next();
  } catch (error) {
    next(new Error('Subscription check failed'));
  }
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  marketingAuth,
  requirePremium,
  requireVIP,
  checkContactUnlockLimit,
  verifyTargetUser,
  socketAuth,
  socketRequirePremium,
  extractToken,
};
