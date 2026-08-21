/**
 * Structured Logging System
 * Production-grade logging with different levels and formats
 */

const config = require('../config/env');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = config.isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

// ==================== REDACTION ====================
//
// There was no redaction anywhere in the backend, so any caller passing a token
// or password through `meta` wrote it to the log verbatim, and request logging
// emitted `req.originalUrl` raw — which leaks the secret for token-in-path
// routes such as GET /invite/:token (those also land in nginx access logs).
//
// Redaction happens in formatLogEntry so it covers EVERY call site, including
// ones added later, rather than depending on each caller remembering.

const SENSITIVE_KEY_PATTERN =
  /(pass(word|wd)?|token|secret|api[-_]?key|authorization|cookie|otp|cvv|card|pin|credential|signature|jwt)/i;

// Keys that carry a secret in their VALUE and must never be printed.
const REDACTED = '[REDACTED]';
const MAX_REDACT_DEPTH = 6;

const redactValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_REDACT_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, depth + 1));
  }

  if (typeof value === 'object') {
    // Errors are not plain objects; keep their useful surface.
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? REDACTED : redactValue(v, depth + 1);
    }
    return out;
  }

  return value;
};

/**
 * Strip secrets carried in a URL: both the path segment of token-bearing routes
 * and any sensitive query parameter. Returns the path with values masked.
 */
const SECRET_PATH_PREFIXES = [
  '/invite/',
  '/api/invite/',
  '/api/v1/invite/',
  '/auth/reset-password/',
  '/api/v1/auth/reset-password/',
  // Guardian invite tokens are 32-byte bearer secrets carried in the URL path.
  // They were absent here, so every 4xx/5xx on this route logged the token
  // verbatim to the application log (and to any upstream proxy access log).
  '/guardian/resolve-invite/',
  '/api/guardian/resolve-invite/',
  '/api/v1/guardian/resolve-invite/',
];

const redactUrl = (url) => {
  if (typeof url !== 'string' || !url) return url;

  let [pathPart, queryPart] = url.split('?');

  for (const prefix of SECRET_PATH_PREFIXES) {
    if (pathPart.startsWith(prefix)) {
      pathPart = `${prefix}${REDACTED}`;
      break;
    }
  }

  if (!queryPart) return pathPart;

  const safeQuery = queryPart
    .split('&')
    .map((pair) => {
      const [k, ...rest] = pair.split('=');
      if (!rest.length) return k;
      return SENSITIVE_KEY_PATTERN.test(k) ? `${k}=${REDACTED}` : pair;
    })
    .join('&');

  return `${pathPart}?${safeQuery}`;
};

// Format log entry
const formatLogEntry = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: config.env,
    ...redactValue(meta),
  };

  // `url` is a structural field rather than a secret-named key, so it needs its
  // own pass — the secret lives in the path/query, not under a telling key.
  if (typeof entry.url === 'string') entry.url = redactUrl(entry.url);
  if (typeof entry.path === 'string') entry.path = redactUrl(entry.path);

  // Remove undefined values
  Object.keys(entry).forEach(key => {
    if (entry[key] === undefined) {
      delete entry[key];
    }
  });

  return entry;
};

// Core logging functions
const log = {
  error: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      const entry = formatLogEntry('ERROR', message, meta);
      console.error(JSON.stringify(entry));
    }
  },

  warn: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      const entry = formatLogEntry('WARN', message, meta);
      console.warn(JSON.stringify(entry));
    }
  },

  info: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      const entry = formatLogEntry('INFO', message, meta);
      console.log(JSON.stringify(entry));
    }
  },

  debug: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      const entry = formatLogEntry('DEBUG', message, meta);
      console.log(JSON.stringify(entry));
    }
  },

  // Security-specific logging
  security: (event, meta = {}) => {
    const entry = formatLogEntry('SECURITY', event, {
      ...meta,
      category: 'security',
    });
    console.warn(JSON.stringify(entry));
  },

  // Audit logging for sensitive operations
  audit: (action, meta = {}) => {
    const entry = formatLogEntry('AUDIT', action, {
      ...meta,
      category: 'audit',
    });
    console.log(JSON.stringify(entry));
  },

  // Performance logging
  performance: (operation, durationMs, meta = {}) => {
    const entry = formatLogEntry('PERF', operation, {
      ...meta,
      durationMs,
      category: 'performance',
    });
    
    // Warn if slow
    if (durationMs > 5000) {
      console.warn(JSON.stringify(entry));
    } else if (config.isDevelopment || durationMs > 1000) {
      console.log(JSON.stringify(entry));
    }
  },
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capture original end function
  const originalEnd = res.end;

  res.end = function (...args) {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Build log entry
    const logEntry = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.clientIp || req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 200),
      userId: req.user?.id,
    };

    // Add query params in development
    if (config.isDevelopment && Object.keys(req.query).length > 0) {
      logEntry.query = req.query;
    }

    // Log based on status code
    if (res.statusCode >= 500) {
      log.error('Request failed', logEntry);
    } else if (res.statusCode >= 400) {
      log.warn('Request error', logEntry);
    } else if (config.isDevelopment || duration > 1000) {
      log.info('Request completed', logEntry);
    }

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
};

// Error logging helper
const logError = (error, req = null) => {
  const meta = {
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
    stack: config.isDevelopment ? error.stack : undefined,
  };

  if (req) {
    meta.requestId = req.id;
    meta.method = req.method;
    meta.url = req.originalUrl;
    meta.userId = req.user?.id;
  }

  log.error(error.message, meta);
};

// Security event logging
const logSecurityEvent = (event, req, additionalMeta = {}) => {
  log.security(event, {
    requestId: req?.id,
    ip: req?.clientIp || req?.ip,
    userId: req?.user?.id,
    userAgent: req?.headers?.['user-agent']?.substring(0, 200),
    url: req?.originalUrl,
    method: req?.method,
    ...additionalMeta,
  });
};

// Audit logging for sensitive operations
const logAudit = (action, userId, details = {}) => {
  log.audit(action, {
    userId,
    ...details,
  });
};

// Performance timing helper
const createTimer = (operation) => {
  const startTime = Date.now();
  return {
    end: (meta = {}) => {
      const duration = Date.now() - startTime;
      log.performance(operation, duration, meta);
      return duration;
    },
  };
};

// Development-friendly console logger (non-JSON)
const devLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 500 ? '\x1b[31m' : // Red
                       res.statusCode >= 400 ? '\x1b[33m' : // Yellow
                       res.statusCode >= 300 ? '\x1b[36m' : // Cyan
                       '\x1b[32m'; // Green
    
    // Same redaction as the structured logger. This path only runs in
    // development, but dev console output routinely gets pasted into issues and
    // screenshots, so it must not print invite/reset tokens either.
    console.log(
      `${statusColor}${req.method}\x1b[0m ${redactUrl(req.originalUrl)} ` +
      `${statusColor}${res.statusCode}\x1b[0m ` +
      `\x1b[90m${duration}ms\x1b[0m ` +
      `${req.user?.id ? `[${req.user.id.substring(0, 8)}]` : ''}`
    );
  });

  next();
};

// Export based on environment
module.exports = config.isDevelopment ? devLogger : requestLogger;

// Also export logging utilities
module.exports.log = log;
module.exports.logError = logError;
module.exports.logSecurityEvent = logSecurityEvent;
module.exports.logAudit = logAudit;
module.exports.createTimer = createTimer;
module.exports.requestLogger = requestLogger;
// Exported for tests — redaction is a security control, so it gets pinned.
module.exports.redactValue = redactValue;
module.exports.redactUrl = redactUrl;
