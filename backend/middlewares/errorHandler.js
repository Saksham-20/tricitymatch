/**
 * Centralized Error Handler
 * - Removes sensitive error information in production
 * - Standardizes error response format
 * - Logs errors appropriately
 */

const config = require('../config/env');

// Custom Application Error class
class AppError extends Error {
  constructor(message, statusCode, code = 'ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
};

// Error factory functions
const createError = {
  badRequest: (message, details = null) => new AppError(message, 400, ErrorTypes.BAD_REQUEST, details),
  unauthorized: (message = 'Authentication required') => new AppError(message, 401, ErrorTypes.AUTHENTICATION_ERROR),
  forbidden: (message = 'Access denied') => new AppError(message, 403, ErrorTypes.AUTHORIZATION_ERROR),
  notFound: (message = 'Resource not found') => new AppError(message, 404, ErrorTypes.NOT_FOUND),
  conflict: (message) => new AppError(message, 409, ErrorTypes.CONFLICT),
  validation: (message, details = null) => new AppError(message, 400, ErrorTypes.VALIDATION_ERROR, details),
  rateLimit: (message = 'Too many requests') => new AppError(message, 429, ErrorTypes.RATE_LIMIT),
  internal: (message = 'Internal server error') => new AppError(message, 500, ErrorTypes.INTERNAL_ERROR),
};

// Sanitize error message for production
const sanitizeErrorMessage = (error) => {
  // Don't expose internal error details in production
  if (config.isProduction && !error.isOperational) {
    return 'An unexpected error occurred';
  }
  return error.message;
};

// Log error with appropriate level
const logError = (error, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: config.isDevelopment ? error.stack : undefined,
    },
  };

  // Always log errors
  if (error.statusCode >= 500 || !error.isOperational) {
    console.error('ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (config.isDevelopment) {
    console.warn('WARN:', JSON.stringify(errorLog, null, 2));
  }
};

// Handle different error types
const handleSequelizeValidationError = (err) => {
  const messages = err.errors.map(e => e.message);
  return new AppError(
    'Validation failed',
    400,
    ErrorTypes.VALIDATION_ERROR,
    messages
  );
};

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors?.[0]?.path || 'field';
  return new AppError(
    `A record with this ${field} already exists`,
    409,
    ErrorTypes.CONFLICT
  );
};

const handleSequelizeForeignKeyConstraintError = (err) => {
  return new AppError(
    'Referenced resource does not exist',
    400,
    ErrorTypes.BAD_REQUEST
  );
};

const handleJWTError = () => {
  return new AppError('Invalid token', 401, ErrorTypes.AUTHENTICATION_ERROR);
};

const handleJWTExpiredError = () => {
  return new AppError('Token has expired', 401, ErrorTypes.AUTHENTICATION_ERROR);
};

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 400, ErrorTypes.VALIDATION_ERROR);
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400, ErrorTypes.VALIDATION_ERROR);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400, ErrorTypes.VALIDATION_ERROR);
  }
  return new AppError(err.message, 400, ErrorTypes.VALIDATION_ERROR);
};

// Main error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    error = handleSequelizeValidationError(err);
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    error = handleSequelizeUniqueConstraintError(err);
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = handleSequelizeForeignKeyConstraintError(err);
  }
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }
  if (err.name === 'MulterError') {
    error = handleMulterError(err);
  }
  if (err.type === 'entity.parse.failed') {
    error = new AppError('Invalid JSON in request body', 400, ErrorTypes.BAD_REQUEST);
  }
  if (err.type === 'entity.too.large') {
    error = new AppError('Request body too large', 413, ErrorTypes.BAD_REQUEST);
  }

  // Log the error
  logError(error, req);

  // Determine status code
  const statusCode = error.statusCode || 500;

  // Build response
  const response = {
    success: false,
    error: {
      code: error.code || ErrorTypes.INTERNAL_ERROR,
      message: sanitizeErrorMessage(error),
    },
  };

  // Include details for validation errors (safe to expose)
  if (error.code === ErrorTypes.VALIDATION_ERROR && error.details) {
    response.error.details = error.details;
  }

  // Include stack trace in development only
  if (config.isDevelopment) {
    response.error.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = createError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler (for express-validator)
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
    }));
    throw createError.validation('Validation failed', messages);
  }
  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleValidationErrors,
  AppError,
  ErrorTypes,
  createError,
};
