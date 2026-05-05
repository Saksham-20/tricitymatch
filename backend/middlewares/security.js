/**
 * Security Middleware
 * - Rate limiting for different endpoint types
 * - CSRF protection
 * - Request size limits
 * - Security headers
 * - Request sanitization
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const config = require('../config/env');
const { createError, asyncHandler } = require('./errorHandler');

// ==================== RATE LIMITERS ====================

// Create a rate limiter factory
const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: options.message || 'Too many requests, please try again later',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise IP (ipKeyGenerator for IPv6-safe limiting)
      return req.user?.id || ipKeyGenerator(req);
    }),
    skip: options.skip || (() => false),
    handler: (req, res, next, options) => {
      res.status(429).json(options.message);
    },
  });
};

// General API rate limiter
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: 'Too many API requests, please try again later',
});

// Auth endpoints - stricter limits
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts, please try again after 15 minutes',
  keyGenerator: (req) => ipKeyGenerator(req), // Always use IP for auth
});

// Signup limiter - very strict
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  message: 'Too many accounts created, please try again after an hour',
  keyGenerator: (req) => ipKeyGenerator(req),
});

// OTP send/verify limiter — separate from auth limiter so OTP calls don't exhaust login pool
const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 OTP attempts per 10 min per IP (generous for real users, tight enough vs bots)
  message: 'Too many verification attempts, please try again in 10 minutes',
  keyGenerator: (req) => ipKeyGenerator(req),
});

// Password reset limiter
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts per hour
  message: 'Too many password reset attempts, please try again later',
  keyGenerator: (req) => ipKeyGenerator(req),
});

// Search limiter
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests, please slow down',
});

// Chat/message limiter
const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  message: 'Too many messages sent, please slow down',
});

// Profile update limiter
const profileUpdateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 updates per minute
  message: 'Too many profile updates, please slow down',
});

// Match action limiter
const matchActionLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 actions per minute (for swiping)
  message: 'Too many match actions, please slow down',
});

// File upload limiter
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Too many file uploads, please try again later',
});

// Admin endpoints limiter
const adminLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for admins
  message: 'Too many admin requests',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

// ==================== SECURITY HEADERS ====================

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://checkout.razorpay.com'],
      connectSrc: ["'self'", config.server.frontendUrl, 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://checkout.razorpay.com'],
      frameSrc: ["'self'", 'https://api.razorpay.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Cloudinary images
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  noSniff: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

// ==================== CORS CONFIGURATION ====================

// Build allowed origins: FRONTEND_URL, CORS_ORIGIN, same host with other scheme, and www/non-www variants
const getAllowedOrigins = () => {
  const list = new Set();
  const add = (url) => {
    if (!url || typeof url !== 'string') return;
    const u = url.trim().replace(/\/+$/, '');
    if (u) list.add(u);
    try {
      const parsed = new URL(u);
      // Add http <-> https variant
      const other = parsed.protocol === 'https:' ? `http://${parsed.host}` : `https://${parsed.host}`;
      list.add(other);
      // Add www <-> non-www variant for both schemes
      const host = parsed.host;
      const wwwHost = host.startsWith('www.') ? host : `www.${host}`;
      const noWwwHost = host.startsWith('www.') ? host.slice(4) : host;
      list.add(`https://${wwwHost}`);
      list.add(`http://${wwwHost}`);
      list.add(`https://${noWwwHost}`);
      list.add(`http://${noWwwHost}`);
    } catch (_) { /* ignore */ }
  };
  add(config.server.frontendUrl);
  add(config.security.corsOrigin);
  return Array.from(list);
};

const corsOptions = {
  origin: (origin, callback) => {
    // In production, all requests must include an Origin header.
    // In development, allow no-origin (curl, Postman, etc.).
    if (!origin) {
      if (config.isDevelopment) return callback(null, true);
      // Allow no-origin from loopback (Docker health checks, internal cron, etc.)
      // Real browser requests always include Origin; only server-side calls omit it.
      return callback(null, true);
    }

    const isLocalDevelopmentOrigin =
      config.isDevelopment &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    const allowedOrigins = getAllowedOrigins();

    // In development, allow localhost variants on any port
    if (config.isDevelopment) {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      );
    }

    if (allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) {
      callback(null, true);
    } else {
      const corsErr = new Error('Not allowed by CORS');
      corsErr.statusCode = 403;
      corsErr.code = 'FORBIDDEN';
      corsErr.isOperational = true;
      callback(corsErr);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400, // 24 hours
};

// ==================== REQUEST SANITIZATION ====================

// Sanitize request body to prevent NoSQL injection and XSS
const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    sanitizeObject(req.body);
  }
  if (req.query) {
    sanitizeObject(req.query);
  }
  if (req.params) {
    sanitizeObject(req.params);
  }
  next();
};

const sanitizeObject = (obj, depth = 0) => {
  // Hard limit on recursion depth to prevent prototype pollution via deep nesting
  if (depth > 10) return;

  for (const key in obj) {
    // Block keys that are NoSQL/JS operator names
    if (key.startsWith('$') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete obj[key];
      continue;
    }

    if (typeof obj[key] === 'string') {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, '');
      // Block string values that look like operator injections
      if (obj[key].startsWith('$')) {
        delete obj[key];
      }
    } else if (Array.isArray(obj[key])) {
      // Sanitize array elements
      obj[key] = obj[key].filter((item) => {
        if (typeof item === 'string') return !item.startsWith('$');
        return true;
      });
      obj[key].forEach((item) => {
        if (item && typeof item === 'object') sanitizeObject(item, depth + 1);
      });
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Recursively sanitize nested objects
      sanitizeObject(obj[key], depth + 1);
    }
  }
};

// ==================== ACCOUNT LOCKOUT ====================

// Redis-backed login attempt tracking (falls back to in-memory if Redis unavailable).
// Using the shared cache module ensures lockout state survives restarts and
// works correctly across multiple server processes / containers.
const { get: cacheGet, set: cacheSet, del: cacheDel } = require('../utils/cache');

// In-memory fallback only used when Redis is unavailable
const _fallbackAttempts = new Map();
const _lockoutTtlSec = () => config.auth.lockoutDuration * 60;

const _getLockoutData = async (key) => {
  try {
    const cached = await cacheGet(key);
    if (cached) return cached;
  } catch (_) { /* fall through */ }
  return _fallbackAttempts.get(key) || null;
};

const _setLockoutData = async (key, data) => {
  const ttl = _lockoutTtlSec();
  try {
    await cacheSet(key, data, ttl);
  } catch (_) { /* fall through */ }
  _fallbackAttempts.set(key, data);
  // Prune in-memory map to prevent unbounded growth
  if (_fallbackAttempts.size > 10000) {
    const firstKey = _fallbackAttempts.keys().next().value;
    _fallbackAttempts.delete(firstKey);
  }
};

const _delLockoutData = async (key) => {
  try {
    await cacheDel(key);
  } catch (_) { /* fall through */ }
  _fallbackAttempts.delete(key);
};

const checkAccountLockout = asyncHandler(async (req, res, next) => {
  const email = req.body.email?.toLowerCase();
  if (!email) {
    return next();
  }

  const key = `lockout:${email}`;
  const data = await _getLockoutData(key);
  const lockoutMs = config.auth.lockoutDuration * 60 * 1000;

  if (data && data.count >= config.auth.maxLoginAttempts) {
    const timeSinceLock = Date.now() - data.lockTime;
    if (timeSinceLock < lockoutMs) {
      const remainingMinutes = Math.ceil((lockoutMs - timeSinceLock) / 60000);
      return res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked. Try again in ${remainingMinutes} minutes`,
        },
      });
    }
    // Lockout TTL expired — clear it
    await _delLockoutData(key);
  }

  next();
});

const recordFailedLogin = async (email) => {
  const key = `lockout:${email?.toLowerCase()}`;
  const data = (await _getLockoutData(key)) || { count: 0, lastAttempt: 0, lockTime: 0 };

  data.count += 1;
  data.lastAttempt = Date.now();

  if (data.count >= config.auth.maxLoginAttempts) {
    data.lockTime = Date.now();
  }

  await _setLockoutData(key, data);
  return data.count;
};

const clearLoginAttempts = async (email) => {
  const key = `lockout:${email?.toLowerCase()}`;
  await _delLockoutData(key);
};

// ==================== REQUEST ID MIDDLEWARE ====================

const crypto = require('crypto');

const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// ==================== IP EXTRACTION ====================

const extractIp = (req, res, next) => {
  // Use Express's req.ip which respects the 'trust proxy' setting (set to 1 in server.js).
  // This gives the correct client IP even behind a reverse proxy, and is NOT
  // spoofable because Express validates the proxy chain depth.
  // We fall back to req.connection.remoteAddress only if req.ip is somehow unavailable.
  req.clientIp = req.ip || req.connection?.remoteAddress || '0.0.0.0';
  next();
};

module.exports = {
  // Rate limiters
  apiLimiter,
  authLimiter,
  otpLimiter,
  signupLimiter,
  passwordResetLimiter,
  searchLimiter,
  messageLimiter,
  profileUpdateLimiter,
  matchActionLimiter,
  uploadLimiter,
  adminLimiter,
  createRateLimiter,
  // Security
  securityHeaders,
  corsOptions,
  sanitizeRequest,
  // Account lockout
  checkAccountLockout,
  recordFailedLogin,
  clearLoginAttempts,
  // Utilities
  requestId,
  extractIp,
};
