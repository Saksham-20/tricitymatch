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

// Format log entry
const formatLogEntry = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: config.env,
    ...meta,
  };

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
    
    console.log(
      `${statusColor}${req.method}\x1b[0m ${req.originalUrl} ` +
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
