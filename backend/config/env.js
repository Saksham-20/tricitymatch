/**
 * Centralized Environment Configuration
 * All environment variables are validated and exported from here
 * Never access process.env directly in application code
 */

const path = require('path');
const fs = require('fs');

// Load environment variables based on NODE_ENV (from project root, one level above backend/)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(__dirname, '..', '..', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  if (nodeEnv === 'development') {
    const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    console.log(`[env] Loaded ${envFile} from project root. Cloudinary: ${hasCloudinary ? 'yes' : 'no (set CLOUDINARY_* in this file)'}`);
  }
} else {
  const fallbackPath = path.resolve(__dirname, '..', envFile);
  if (fs.existsSync(fallbackPath)) {
    require('dotenv').config({ path: fallbackPath });
    if (nodeEnv === 'development') {
      console.log(`[env] Loaded ${envFile} from backend/ folder`);
    }
  } else if (nodeEnv === 'development') {
    console.warn(`[env] No ${envFile} found at ${envPath} or ${fallbackPath}. Create .env.development at project root with CLOUDINARY_* for Cloudinary uploads.`);
  }
}

// Validation helpers
const requiredString = (key, defaultValue = undefined) => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const requiredNumber = (key, defaultValue = undefined) => {
  const value = process.env[key] ? parseInt(process.env[key], 10) : defaultValue;
  if (value === undefined || isNaN(value)) {
    throw new Error(`Missing or invalid required environment variable: ${key}`);
  }
  return value;
};

const optionalString = (key, defaultValue = '') => {
  return process.env[key] || defaultValue;
};

const optionalNumber = (key, defaultValue = 0) => {
  return process.env[key] ? parseInt(process.env[key], 10) : defaultValue;
};

const optionalBoolean = (key, defaultValue = false) => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
};

// Determine environment (nodeEnv already set above)
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

// Validate JWT secret strength in production
const validateJwtSecret = (secret) => {
  if (isProduction) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    if (secret.includes('change-this') || secret.includes('your-') || secret === 'secret') {
      throw new Error('JWT_SECRET appears to be a placeholder. Set a secure random value in production');
    }
  }
  return secret;
};

// Build configuration object
const config = {
  // Environment
  env: nodeEnv,
  isProduction,
  isDevelopment,
  isTest,

  // Server
  server: {
    port: requiredNumber('PORT', 5000),
    frontendUrl: requiredString('FRONTEND_URL', 'http://localhost:3000'),
    apiVersion: 'v1',
  },

  // Database
  database: {
    host: requiredString('DB_HOST', 'localhost'),
    port: requiredNumber('DB_PORT', 5432),
    username: requiredString('DB_USER', 'postgres'),
    password: requiredString('DB_PASSWORD', 'root'),
    name: requiredString('DB_NAME', 'matrimony_dev'),
    dialect: 'postgres',
    logging: isDevelopment ? console.log : false,
    pool: {
      max: optionalNumber('DB_POOL_MAX', 10),
      min: optionalNumber('DB_POOL_MIN', 2),
      acquire: optionalNumber('DB_POOL_ACQUIRE', 30000),
      idle: optionalNumber('DB_POOL_IDLE', 10000),
    },
    // Only use SSL when DB_SSL=true (e.g. managed cloud DB). Docker Postgres does not use SSL.
    ssl: isProduction && optionalBoolean('DB_SSL', false) ? {
      require: true,
      rejectUnauthorized: optionalBoolean('DB_SSL_REJECT_UNAUTHORIZED', true),
    } : false,
  },

  // JWT & Authentication
  auth: {
    jwtSecret: validateJwtSecret(requiredString('JWT_SECRET', isDevelopment ? 'dev-secret-change-in-production-minimum-32-chars' : undefined)),
    jwtExpiry: optionalString('JWT_EXPIRY', '15m'), // Short-lived access tokens
    refreshTokenExpiry: optionalString('REFRESH_TOKEN_EXPIRY', '7d'),
    resetTokenExpiry: optionalString('RESET_TOKEN_EXPIRY', '1h'),
    bcryptRounds: optionalNumber('BCRYPT_ROUNDS', 12),
    maxLoginAttempts: optionalNumber('MAX_LOGIN_ATTEMPTS', 5),
    lockoutDuration: optionalNumber('LOCKOUT_DURATION_MINUTES', 30),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: optionalNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
    maxRequests: optionalNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    authMaxAttempts: optionalNumber('AUTH_RATE_LIMIT_MAX', 5),
    authWindowMs: optionalNumber('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  },

  // Security
  security: {
    corsOrigin: optionalString('CORS_ORIGIN', 'http://localhost:3000'),
    cookieSecret: optionalString('COOKIE_SECRET', isDevelopment ? 'dev-cookie-secret' : undefined),
    csrfSecret: optionalString('CSRF_SECRET', isDevelopment ? 'dev-csrf-secret' : undefined),
    maxRequestSize: optionalString('MAX_REQUEST_SIZE', '10mb'), // JSON/urlencoded body limit; multipart uses multer
    maxFileSize: optionalNumber('MAX_FILE_SIZE', 5 * 1024 * 1024), // 5MB
  },

  // Razorpay
  razorpay: {
    keyId: optionalString('RAZORPAY_KEY_ID'),
    keySecret: optionalString('RAZORPAY_KEY_SECRET'),
    webhookSecret: optionalString('RAZORPAY_WEBHOOK_SECRET'),
    isConfigured: () => {
      const keyId = optionalString('RAZORPAY_KEY_ID');
      const keySecret = optionalString('RAZORPAY_KEY_SECRET');
      return keyId && keySecret && 
             !keyId.includes('your-') && 
             !keySecret.includes('your-') &&
             keyId.startsWith('rzp_');
    },
  },

  // Email
  email: {
    host: optionalString('EMAIL_HOST', 'smtp.gmail.com'),
    port: optionalNumber('EMAIL_PORT', 587),
    secure: optionalBoolean('EMAIL_SECURE', false),
    user: optionalString('EMAIL_USER'),
    password: optionalString('EMAIL_PASSWORD'),
    from: optionalString('EMAIL_FROM', 'noreply@tricitymatch.com'),
    isConfigured: () => {
      return !!optionalString('EMAIL_USER') && !!optionalString('EMAIL_PASSWORD');
    },
  },

  // Cloudinary
  cloudinary: {
    cloudName: optionalString('CLOUDINARY_CLOUD_NAME'),
    apiKey: optionalString('CLOUDINARY_API_KEY'),
    apiSecret: optionalString('CLOUDINARY_API_SECRET'),
    folder: optionalString('CLOUDINARY_FOLDER', 'tricitymatch'),
    isConfigured: () => {
      return !!optionalString('CLOUDINARY_CLOUD_NAME') && 
             !!optionalString('CLOUDINARY_API_KEY') && 
             !!optionalString('CLOUDINARY_API_SECRET');
    },
  },

  // Upload
  upload: {
    dir: optionalString('UPLOAD_DIR', './uploads'),
    maxFileSize: optionalNumber('MAX_FILE_SIZE', 5 * 1024 * 1024),
    maxGalleryPhotos: optionalNumber('MAX_GALLERY_PHOTOS', 6),
  },

  // Chat
  chat: {
    maxMessageLength: optionalNumber('MAX_MESSAGE_LENGTH', 2000),
    messageEditTimeLimit: optionalNumber('MESSAGE_EDIT_TIME_LIMIT_MINUTES', 15),
  },

  // Admin
  admin: {
    email: optionalString('ADMIN_EMAIL', 'admin@tricitymatch.com'),
  },

  // Redis (for caching and job queues)
  redis: {
    url: optionalString('REDIS_URL', ''),
    host: optionalString('REDIS_HOST', 'localhost'),
    port: optionalNumber('REDIS_PORT', 6379),
    password: optionalString('REDIS_PASSWORD', ''),
    tls: optionalBoolean('REDIS_TLS', false),
    maxRetriesPerRequest: optionalNumber('REDIS_MAX_RETRIES', 3),
    isConfigured: () => {
      return !!optionalString('REDIS_URL') || !!optionalString('REDIS_HOST');
    },
  },

  // Monitoring & Alerting
  monitoring: {
    enabled: optionalBoolean('MONITORING_ENABLED', true),
    alertEmails: optionalString('ALERT_EMAILS', ''),
    slackWebhook: optionalString('SLACK_WEBHOOK_URL', ''),
    metricsPath: optionalString('METRICS_PATH', '/monitoring/metrics'),
  },
};

// Freeze config to prevent modifications
const deepFreeze = (obj) => {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null && typeof obj[key] !== 'function') {
      deepFreeze(obj[key]);
    }
  });
  return Object.freeze(obj);
};

module.exports = deepFreeze(config);
