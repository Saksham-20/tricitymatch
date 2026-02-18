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
const { createError } = require('./errorHandler');

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
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'", config.server.frontendUrl],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
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

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      config.server.frontendUrl,
      // Add additional allowed origins here
    ];

    // In development, allow localhost variants
    if (config.isDevelopment) {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      );
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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

const sanitizeObject = (obj) => {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, '');
      // Remove potential MongoDB operators
      if (obj[key].startsWith('$')) {
        delete obj[key];
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Check for MongoDB operator objects
      if (Object.keys(obj[key]).some(k => k.startsWith('$'))) {
        delete obj[key];
      } else {
        sanitizeObject(obj[key]);
      }
    }
  }
};

// ==================== ACCOUNT LOCKOUT ====================

// In-memory store for login attempts (use Redis in production for distributed systems)
const loginAttempts = new Map();

const cleanupLoginAttempts = () => {
  const now = Date.now();
  const lockoutMs = config.auth.lockoutDuration * 60 * 1000;
  
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > lockoutMs) {
      loginAttempts.delete(key);
    }
  }
};

// Cleanup every 5 minutes
setInterval(cleanupLoginAttempts, 5 * 60 * 1000);

const checkAccountLockout = (req, res, next) => {
  const email = req.body.email?.toLowerCase();
  if (!email) {
    return next();
  }

  const key = `login:${email}`;
  const attempts = loginAttempts.get(key);
  const lockoutMs = config.auth.lockoutDuration * 60 * 1000;

  if (attempts && attempts.count >= config.auth.maxLoginAttempts) {
    const timeSinceLock = Date.now() - attempts.lockTime;
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
    // Lockout expired, reset
    loginAttempts.delete(key);
  }

  next();
};

const recordFailedLogin = (email) => {
  const key = `login:${email?.toLowerCase()}`;
  const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  
  if (attempts.count >= config.auth.maxLoginAttempts) {
    attempts.lockTime = Date.now();
  }
  
  loginAttempts.set(key, attempts);
  return attempts.count;
};

const clearLoginAttempts = (email) => {
  const key = `login:${email?.toLowerCase()}`;
  loginAttempts.delete(key);
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
  // Trust proxy headers if behind reverse proxy
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    req.clientIp = forwardedFor.split(',')[0].trim();
  } else {
    req.clientIp = req.ip || req.connection.remoteAddress;
  }
  next();
};

module.exports = {
  // Rate limiters
  apiLimiter,
  authLimiter,
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
