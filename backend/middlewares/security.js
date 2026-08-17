/**
 * Security Middleware
 * - Rate limiting for different endpoint types
 * - CSRF protection
 * - Request size limits
 * - Security headers
 * - Request sanitization
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
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
      return req.user?.id || ipKeyGenerator(req.ip);
    }),
    // Forwarded explicitly: this factory whitelists options, so anything not
    // listed here is silently dropped rather than reaching express-rate-limit.
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    skip: options.skip || (() => config.security.disableRateLimits),
    handler: (req, res, next, options) => {
      res.status(429).json(options.message);
    },
  });
};

// General API rate limiter.
//
// This is mounted globally on /api, i.e. BEFORE any route-level auth runs, so
// `req.user` is never populated here and the default keyGenerator silently fell
// back to the IP for everyone. Two consequences, both observed live:
//   1. Behind shared NAT (mobile CGNAT, office/college wifi) every member drew
//      from ONE 200-request bucket — the app became unusable within minutes.
//   2. A single member browsing normally blows 200 requests in 15 min easily
//      (this SPA fires 5-8 calls per page), and a 429 on /auth/me is read by the
//      client as "session gone" → the user is force-logged-out at random.
// Fix: key by the authenticated user when a valid access token is present, and
// use a ceiling that matches how chatty the SPA actually is. Anonymous traffic
// still falls back to per-IP limiting.
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 900, // per user (or per IP when unauthenticated)
  message: 'Too many API requests, please try again later',
  keyGenerator: (req) => {
    const token = req.header('Authorization')?.startsWith('Bearer ')
      ? req.header('Authorization').substring(7)
      : req.cookies?.accessToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        if (decoded?.userId) return `user:${decoded.userId}`;
      } catch {
        // Expired/invalid token — fall through to IP keying.
      }
    }
    return ipKeyGenerator(req.ip);
  },
});

// Auth endpoints - stricter limits.
// Counts FAILED attempts only: a successful login is not abuse, and counting it
// meant a shared public IP (mobile CGNAT, office/college wifi — the norm for our
// hyperlocal user base) burned its whole budget on legitimate sign-ins and then
// 429'd innocent users. The real per-account brute-force defense is the email-keyed
// lockout below (config.auth.maxLoginAttempts / lockoutDuration); this IP limiter
// is only a backstop against spray attacks, so it can be generous.
const authLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 FAILED attempts per IP
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: (req) => ipKeyGenerator(req.ip), // Always use IP for auth
  skipSuccessfulRequests: true,
});

// Token refresh is a background rotation every ~15 min per active session, not a
// credential-guessing surface (it needs a valid, single-use refresh cookie and is
// already protected by rotation + family revoke). It must NOT share the login
// budget: doing so meant one active tab could exhaust the pool and lock the whole
// IP out of /auth/login.
const refreshLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60, // plenty for many concurrent sessions behind one NAT
  message: 'Too many session refresh attempts. Please try again later.',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  skipSuccessfulRequests: true,
});

// Signup limiter - strict, but only counts accounts that were ACTUALLY created.
// Counting rejected attempts meant three mistyped emails locked a genuine user
// (and everyone sharing their NAT'd IP) out of registering for a full hour —
// a silent conversion killer. Junk requests are still covered by apiLimiter.
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 real signups per hour per IP (families often register together)
  message: 'Too many accounts created, please try again after an hour',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  skipFailedRequests: true,
});

// Public contact form limiter — anti-spam without blocking genuine enquiries
const contactLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 enquiries per hour per IP
  message: 'Too many messages sent, please try again after an hour',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Public invite-resolve limiter (Phase S) — GET /invite/:token returns an
// inviter's first name, so the budget is sized to stop the token space being
// swept for valid links while staying invisible to a real invitee (who resolves
// once per page load, plus retries).
const inviteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 lookups per 15 min per IP
  message: 'Too many invite lookups, please try again shortly',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// OTP send/verify limiter — separate from auth limiter so OTP calls don't exhaust login pool
const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 OTP attempts per 10 min per IP (generous for real users, tight enough vs bots)
  message: 'Too many verification attempts, please try again in 10 minutes',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Password reset REQUEST limiter — throttles how often reset emails can be
// triggered for an IP. Successful sends still count (that is the abuse vector).
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reset emails per hour per IP (was 3 — too tight behind shared NAT)
  message: 'Too many password reset attempts, please try again later',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Password reset SUBMIT limiter — separate budget from the request limiter.
// Sharing one meant a user who mistyped the new password twice burned the whole
// hourly pool and was locked out mid-reset while holding a valid token. This
// endpoint requires a signed, single-use reset token, so it is not a spray
// surface; only failed submissions count.
const passwordResetSubmitLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 FAILED submissions per hour per IP
  message: 'Too many password reset attempts, please try again later',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  skipSuccessfulRequests: true,
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
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
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
      // Razorpay's standard checkout renders from checkout.razorpay.com as well
      // as api.razorpay.com; allowing only the latter risks the payment modal
      // being blocked outright in production, where this CSP actually applies
      // (dev is served by Vite, so it never shows up locally).
      frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
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

// Returns true if an explicit Origin header value is on the allow-list.
const isAllowedOrigin = (origin) => {
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

  return allowedOrigins.includes(origin) || isLocalDevelopmentOrigin;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Per-request CORS delegate (cors() supports `(req, callback)` form, which —
// unlike the bare origin callback — exposes the HTTP method so we can vary the
// no-Origin policy by method.
const corsDelegate = (req, callback) => {
  const origin = req.headers.origin;
  const baseOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: corsAllowedHeaders,
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400,
  };

  // SEC-2 / BUG-P005: browsers DO NOT attach an Origin header to same-origin
  // GET/HEAD requests. Since the SPA and API share the production origin
  // (tricityshadi.com), the entire read path of the app arrives with no Origin.
  // Allow no-Origin for safe (non-mutating) methods + preflight; keep rejecting
  // no-Origin on state-changing methods (real browser writes always carry
  // Origin; provider webhooks are exempted earlier via monitoringCors).
  if (!origin) {
    // Native mobile clients (React Native) send NO Origin header on any request,
    // so they'd be blocked on every state-changing call — login/signup included.
    // They authenticate with Bearer tokens (not cookies), so the browser-CSRF
    // rationale for the no-Origin block does not apply to them. Gate on a custom
    // header the app sends: a cross-site browser attacker cannot set a custom
    // header without a CORS preflight (which enforces the allowlist), so this
    // does not reopen the cookie-CSRF hole the block closes.
    const isNativeClient = String(req.headers['x-app-client'] || '').toLowerCase() === 'mobile';
    if (config.isDevelopment || SAFE_METHODS.has((req.method || '').toUpperCase()) || isNativeClient) {
      return callback(null, { ...baseOptions, origin: true });
    }
    const noOriginErr = new Error('Not allowed by CORS');
    noOriginErr.statusCode = 403;
    noOriginErr.code = 'FORBIDDEN';
    noOriginErr.isOperational = true;
    return callback(noOriginErr);
  }

  if (isAllowedOrigin(origin)) {
    return callback(null, { ...baseOptions, origin: true });
  }
  const corsErr = new Error('Not allowed by CORS');
  corsErr.statusCode = 403;
  corsErr.code = 'FORBIDDEN';
  corsErr.isOperational = true;
  return callback(corsErr);
};

const corsAllowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-CSRF-Token',
  'X-App-Client',
  'Accept',
  'Origin',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      if (config.isDevelopment) return callback(null, true);
      const noOriginErr = new Error('Not allowed by CORS');
      noOriginErr.statusCode = 403;
      noOriginErr.code = 'FORBIDDEN';
      noOriginErr.isOperational = true;
      return callback(noOriginErr);
    }
    if (isAllowedOrigin(origin)) {
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
  // QA/e2e kill switch (dev-only, see config.security.disableRateLimits)
  if (config.security.disableRateLimits) {
    return next();
  }

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
      return res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to too many attempts. Please try again later.',
        },
      });
    }
    // Lockout TTL expired — clear it
    await _delLockoutData(key);
  }

  next();
});

const recordFailedLogin = async (email) => {
  if (config.security.disableRateLimits) {
    return 0;
  }
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
  refreshLimiter,
  otpLimiter,
  signupLimiter,
  contactLimiter,
  inviteLimiter,
  passwordResetLimiter,
  passwordResetSubmitLimiter,
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
  corsDelegate,
  sanitizeRequest,
  // Account lockout
  checkAccountLockout,
  recordFailedLogin,
  clearLoginAttempts,
  // Utilities
  requestId,
  extractIp,
};
