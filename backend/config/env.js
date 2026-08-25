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

const hasRealSecret = (value) => {
  if (!value) return false;

  const normalized = String(value).trim().toLowerCase();
  // Reject obvious placeholder / template values so a stand-in can never silently
  // pass as a real secret (e.g. RAZORPAY_WEBHOOK_SECRET=placeholder_add_real_key_later,
  // which let anyone forge webhook signatures — H-3, 2026-07-01 pentest).
  const placeholderTokens = [
    'your-', 'xxxxxxxx', 'placeholder', 'add_real', 'change-this', 'change-me',
    'changeme', 'replace-me', 'replace_me', 'example', 'dummy', 'todo', '<',
    // Shipped-template phrasings. .env.example's COOKIE_SECRET value
    // ('another-secure-random-string-for-cookies') matched none of the tokens
    // above and is over 32 chars, so copying the template into production
    // booted with a publicly-known cookie secret.
    'random-string', 'secure-random', '-for-cookies',
  ];
  return !placeholderTokens.some((t) => normalized.includes(t));
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
    port: requiredNumber('PORT', 5001),
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
      max: optionalNumber('DB_POOL_MAX', 30),
      min: optionalNumber('DB_POOL_MIN', 5),
      acquire: optionalNumber('DB_POOL_ACQUIRE', 60000),
      idle: optionalNumber('DB_POOL_IDLE', 5000),
      evictionRunIntervalMillis: optionalNumber('DB_POOL_EVICTION_INTERVAL', 10000),
    },
    // SSL is ON by default in production. Set DB_DISABLE_SSL=true to opt out (e.g. Docker internal Postgres).
    ssl: isProduction && !optionalBoolean('DB_DISABLE_SSL', false) ? {
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
    lockoutDuration: optionalNumber('LOCKOUT_DURATION_MINUTES', 10),
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
    // Local QA/e2e only: disables all rate limiters + login lockout so test
    // fleets can hammer the API. Hard NODE_ENV guard — can never activate in prod.
    disableRateLimits:
      process.env.DISABLE_RATE_LIMITS === 'true' && process.env.NODE_ENV !== 'production',
  },

  // Razorpay
  razorpay: {
    keyId: optionalString('RAZORPAY_KEY_ID'),
    keySecret: optionalString('RAZORPAY_KEY_SECRET'),
    // Only expose the webhook secret if it's a REAL value. A placeholder resolves
    // to '' so the webhook route treats it as unconfigured and DISCARDS instead of
    // verifying signatures against a guessable string (H-3 forgery fix).
    webhookSecret: hasRealSecret(optionalString('RAZORPAY_WEBHOOK_SECRET'))
      ? optionalString('RAZORPAY_WEBHOOK_SECRET')
      : '',
    isConfigured: () => {
      const keyId = optionalString('RAZORPAY_KEY_ID');
      const keySecret = optionalString('RAZORPAY_KEY_SECRET');
      return keyId.startsWith('rzp_') && hasRealSecret(keyId) && hasRealSecret(keySecret);
    },
  },

  // Email
  email: {
    // Transactional provider — Resend (primary). SMTP kept for later
    // (invoices / receipts / manual mail). email.js prefers Resend when its
    // API key is set, otherwise falls back to SMTP, otherwise dev-logs.
    resend: {
      apiKey: optionalString('RESEND_API_KEY'),
      isConfigured: () => !!optionalString('RESEND_API_KEY'),
    },
    // SMTP (nodemailer) — fallback / future invoices+receipts
    host: optionalString('EMAIL_HOST', 'smtp.gmail.com'),
    port: optionalNumber('EMAIL_PORT', 587),
    secure: optionalBoolean('EMAIL_SECURE', false),
    user: optionalString('EMAIL_USER'),
    password: optionalString('EMAIL_PASSWORD'),
    // Shared identity (used by both Resend + SMTP). `from` must be an address on
    // a domain verified in Resend, e.g. noreply@tricitymatch.com.
    from: optionalString('EMAIL_FROM', 'noreply@tricitymatch.com'),
    fromName: optionalString('EMAIL_FROM_NAME', 'TricityMatch'),
    replyTo: optionalString('EMAIL_REPLY_TO', optionalString('SUPPORT_EMAIL', 'support@tricitymatch.com')),
    /**
     * Dry run: render and log the mail, send nothing.
     *
     * Defaults ON outside production. The dev `.env` carries the SAME Resend
     * key as production, so any dev run of a batch job spends the live daily
     * quota — and once that quota is gone, production OTP and password-reset
     * mail stops for everyone until it resets. That happened once; this flag
     * is why it cannot happen twice. Set EMAIL_DRY_RUN=false locally when you
     * genuinely need to see a real message land.
     */
    dryRun: optionalBoolean('EMAIL_DRY_RUN', !isProduction),
    support: optionalString('SUPPORT_EMAIL', 'support@tricitymatch.com'),
    // SMTP creds present (real, not placeholder)
    smtpConfigured: () => {
      const u = optionalString('EMAIL_USER');
      const p = optionalString('EMAIL_PASSWORD');
      return !!u && !!p && u !== 'your-email@gmail.com' && p !== 'your-app-password';
    },
    // Any transactional channel wired (Resend OR SMTP)
    isConfigured: () => {
      const u = optionalString('EMAIL_USER');
      return !!optionalString('RESEND_API_KEY') ||
        (!!u && !!optionalString('EMAIL_PASSWORD') && u !== 'your-email@gmail.com');
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

  // SMS / OTP (Fast2SMS primary, MSG91 alternative)
  sms: {
    provider: optionalString('SMS_PROVIDER', 'dev'), // 'fast2sms' | 'msg91' | 'dev'
    apiKey: optionalString('SMS_API_KEY'),
    senderId: optionalString('SMS_SENDER_ID', 'TRCSDI'),
    msg91TemplateId: optionalString('MSG91_TEMPLATE_ID'),
    // ⚠️ PRE-LAUNCH TESTING ONLY — master OTP codes that always verify when SMS
    // is not yet wired. REMOVE (unset OTP_BYPASS_CODES) before real users.
    bypassCodes: optionalString('OTP_BYPASS_CODES', '')
      .split(',').map(s => s.trim()).filter(Boolean),
    isConfigured: () => {
      const p = optionalString('SMS_PROVIDER', 'dev');
      return p !== 'dev' && !!optionalString('SMS_API_KEY');
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

  // Google OAuth
  google: {
    clientId: optionalString('GOOGLE_CLIENT_ID'),
    isConfigured: () => !!optionalString('GOOGLE_CLIENT_ID'),
  },

  // Google Play Billing (Android in-app subscription receipt verification).
  // serviceAccountJson = raw JSON string of a Play-linked service account with
  // the "View financial data / manage orders" permission (androidpublisher).
  googlePlay: {
    // NOT a brand typo: `com.tricityshadi.app` is the shipped Android package ID.
    // A package name is permanent once published — it must keep matching
    // mobile/app.json, or receipt verification fails against the wrong app.
    packageName: optionalString('GOOGLE_PLAY_PACKAGE_NAME', 'com.tricityshadi.app'),
    serviceAccountJson: optionalString('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
    isConfigured: () => !!optionalString('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
  },

  // Agora RTC (voice/video calls)
  agora: {
    appId: optionalString('AGORA_APP_ID'),
    appCertificate: optionalString('AGORA_APP_CERTIFICATE'),
    tokenExpiry: optionalNumber('AGORA_TOKEN_EXPIRY_SECONDS', 3600),
    isConfigured: () => !!optionalString('AGORA_APP_ID') && !!optionalString('AGORA_APP_CERTIFICATE'),
  },

  // Firebase Cloud Messaging (push notifications)
  fcm: {
    serviceAccountPath: optionalString('FIREBASE_SERVICE_ACCOUNT_PATH'),
    projectId: optionalString('FIREBASE_PROJECT_ID'),
    isConfigured: () => !!optionalString('FIREBASE_SERVICE_ACCOUNT_PATH') && !!optionalString('FIREBASE_PROJECT_ID'),
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

  // Founding-member offer (Phase S)
  // The offer is CLOSED unless FOUNDING_PERIOD_ENDS is set to a future ISO date.
  // Unset (the default) means no grant ever fires — the surfaces that promise a
  // "free premium period" must stay dark until this is deliberately turned on.
  founding: {
    // ISO date/datetime string, e.g. 2026-10-31 or 2026-10-31T23:59:59+05:30.
    // Doubles as the granted subscription's endDate, so the whole cohort expires
    // together rather than each member 30 days after they happened to sign up.
    endsAt: optionalString('FOUNDING_PERIOD_ENDS', ''),
    // Optional hard cap on how many founding grants exist. 0 / unset = no cap.
    memberCap: optionalNumber('FOUNDING_MEMBER_CAP', 0),
    // Date half of the gate only. The member-count half needs a DB read, so the
    // CALLER (utils/foundingGrant.js) checks it — this stays synchronous and
    // dependency-free so any surface can ask "is the window open at all?".
    isOpen: () => {
      const raw = optionalString('FOUNDING_PERIOD_ENDS', '');
      if (!raw) return false;
      const ends = new Date(raw);
      if (Number.isNaN(ends.getTime())) return false;
      return ends.getTime() > Date.now();
    },
  },

  // Runtime feature flags (Phase 2).
  // These are read by the SERVER and echoed to clients in the `features` block
  // on /auth/me — never mirrored into a VITE_ build var, because a build-baked
  // copy drifts from the backend and would sell premium chat that is actually
  // free (or vice versa).
  features: {
    // Chat with a mutual match without a paid plan. Ships DARK: the default is
    // today's behaviour (chat is premium-only). Two-way door — flipping it
    // writes nothing to the database, so flipping back restores the gate.
    freeChatForMutuals: optionalBoolean('FREE_CHAT_FOR_MUTUALS', false),
    // D1 free-reply window: a premium member's first message grants the free
    // receiver a limited reply window (constants/chat.js). Ships DARK in prod
    // (owner decision 2026-08-19 — flip once mutual-match liquidity supports
    // it). Two-way door: flipping only changes whether NEW grants are created
    // and whether existing grants authorize; rows persist harmlessly when off.
    freeReplyWindow: optionalBoolean('FREE_REPLY_WINDOW', false),
    // D7: astrologer marketplace visibility. Default OFF — routes 404 and
    // clients hide the entry points until the owner turns it on.
    astrologerMarketplace: optionalBoolean('ASTROLOGER_MARKETPLACE', false),
  },

  // Abuse ceilings that are not rate limiters (those live in middlewares/security).
  limits: {
    // Rolling-24h contact-unlock ceiling for UNLIMITED tiers (vip / nri).
    // "Unlimited" is a product promise; this stops one cheap subscription from
    // being a scriptable export of every phone number in the directory.
    // 0 disables the ceiling.
    unlimitedDailyUnlockCap: optionalNumber('UNLIMITED_DAILY_UNLOCK_CAP', 25),
    // Contact unlocks granted to EACH side of an accepted member invite
    // (utils/inviteReward.js). Costs no cash and attacks the constraint that
    // actually binds at launch — how many profiles there are to unlock.
    // 0 disables the reward without removing the invite flow.
    inviteRewardUnlocks: optionalNumber('INVITE_REWARD_UNLOCKS', 3),
    // Lifetime ceiling on rewarded invites per member. 0 disables the ceiling
    // (do not set that in production — see utils/inviteReward.js).
    inviteRewardMaxPerInviter: optionalNumber('INVITE_REWARD_MAX_PER_INVITER', 20),
  },

  // Monitoring & Alerting
  monitoring: {
    enabled: optionalBoolean('MONITORING_ENABLED', true),
    alertEmails: optionalString('ALERT_EMAILS', ''),
    slackWebhook: optionalString('SLACK_WEBHOOK_URL', ''),
    metricsPath: optionalString('METRICS_PATH', '/monitoring/metrics'),
  },
};

// ==================== PRODUCTION STARTUP VALIDATION ====================
// Fail fast in production if critical values are missing or are known placeholders.
if (isProduction) {
  const errors = [];   // always fatal — true security must-haves
  const warnings = []; // not-yet-wired providers (downgraded when ALLOW_INSECURE_PROD)

  // ⚠️ PRE-LAUNCH ESCAPE HATCH — when true, provider gaps (SMS/SMTP/Razorpay)
  // are warnings not boot blockers, so the app can run for testing before real
  // creds exist. REMOVE (set false / unset) before real users. Core auth/db
  // checks below stay ALWAYS fatal regardless of this flag.
  const allowInsecureProd = optionalBoolean('ALLOW_INSECURE_PROD', false);

  // ── Always fatal: core auth/session/db/url integrity ──
  // Master OTP codes verify ANY phone/email, for ANY account. Shipping them to
  // production is a universal account-takeover primitive, so it is fatal here
  // and NOT downgradable by ALLOW_INSECURE_PROD. Previously this only produced
  // a console warning — and that warning lived inside the ALLOW_INSECURE_PROD
  // branch, so with the flag off it printed nothing at all.
  if (config.sms.bypassCodes.length > 0) {
    errors.push('OTP_BYPASS_CODES must be empty in production (master OTP codes bypass all verification)');
  }

  // The escape hatch itself is a pre-launch-only device. Leaving it on in
  // production means booting with an unverifiable payment webhook and no OTP
  // delivery, so refuse rather than warn.
  if (allowInsecureProd) {
    errors.push('ALLOW_INSECURE_PROD must not be enabled in production');
  }

  // JWT secret must not be the dev default or any placeholder value
  if (!config.auth.jwtSecret || config.auth.jwtSecret.includes('dev-secret')) {
    errors.push('JWT_SECRET must be a strong secret in production (not the dev placeholder)');
  } else if (!hasRealSecret(config.auth.jwtSecret)) {
    errors.push('JWT_SECRET looks like a placeholder value — set a real random secret');
  }

  // Cookie secret must be set, not the dev default, at least 32 chars, and not
  // a placeholder. Length alone passed strings like 'example-example-...'.
  if (!config.security.cookieSecret || config.security.cookieSecret === 'dev-cookie-secret') {
    errors.push('COOKIE_SECRET must be set to a strong random value in production');
  } else if (config.security.cookieSecret.length < 32) {
    errors.push('COOKIE_SECRET must be at least 32 characters in production');
  } else if (!hasRealSecret(config.security.cookieSecret)) {
    errors.push('COOKIE_SECRET looks like a placeholder value — set a real random secret');
  }

  // Database password must not be a well-known default. 'root' alone was
  // checked, which let the docker-compose default (`postgres`) sail through.
  const WEAK_DB_PASSWORDS = ['root', 'postgres', 'password', 'admin', 'changeme', 'secret'];
  if (!config.database.password) {
    errors.push('DB_PASSWORD must be set in production');
  } else if (WEAK_DB_PASSWORDS.includes(String(config.database.password).toLowerCase())) {
    errors.push('DB_PASSWORD is a well-known default value — set a strong password');
  } else if (!hasRealSecret(config.database.password)) {
    errors.push('DB_PASSWORD looks like a placeholder value — set a strong password');
  }

  // FRONTEND_URL must be a real HTTPS URL
  if (!config.server.frontendUrl || !config.server.frontendUrl.startsWith('https://')) {
    errors.push('FRONTEND_URL must use https:// in production');
  }

  // CSRF_SECRET had NO production validation of any kind, and docker-compose
  // never passed it through, so production ran with it empty.
  if (!config.security.csrfSecret) {
    errors.push('CSRF_SECRET must be set in production');
  } else if (config.security.csrfSecret === 'dev-csrf-secret') {
    errors.push('CSRF_SECRET must not be the development default in production');
  } else if (config.security.csrfSecret.length < 32) {
    errors.push('CSRF_SECRET must be at least 32 characters in production');
  } else if (!hasRealSecret(config.security.csrfSecret)) {
    errors.push('CSRF_SECRET looks like a placeholder value \u2014 set a real random secret');
  }

  // Distinct secrets. Reusing one value means a single disclosure compromises
  // session signing, cookie integrity and CSRF at the same time.
  const seenSecrets = new Map();
  for (const [secretName, secretValue] of [
    ['JWT_SECRET', config.auth.jwtSecret],
    ['COOKIE_SECRET', config.security.cookieSecret],
    ['CSRF_SECRET', config.security.csrfSecret],
  ]) {
    if (!secretValue) continue;
    if (seenSecrets.has(secretValue)) {
      errors.push(`${secretName} must not reuse the same value as ${seenSecrets.get(secretValue)}`);
    } else {
      seenSecrets.set(secretValue, secretName);
    }
  }

  // Redis stores plaintext OTP codes, login-lockout counters and cached profile
  // payloads. Unauthenticated Redis is readable by anything that can reach the
  // port, including any other container on a shared bridge network.
  if (!config.redis.password) {
    errors.push('REDIS_PASSWORD must be set in production (Redis holds OTP codes and lockout state)');
  }

  // A low bcrypt cost silently destroys password-hash strength.
  if (!Number.isFinite(config.auth.bcryptRounds) || config.auth.bcryptRounds < 10) {
    errors.push('BCRYPT_ROUNDS must be at least 10 in production');
  }

  // The development database name in production means either the wrong database
  // or an unreviewed deployment. Either way, stop.
  if (config.database.name === 'matrimony_dev') {
    errors.push('DB_NAME is still the development default (matrimony_dev) \u2014 set the production database name');
  }

  // DB_DISABLE_SSL=true turns off TLS to the database with no other signal.
  // Defensible only for a container-internal Postgres on a private network,
  // which should be stated explicitly rather than defaulted into.
  if (optionalBoolean('DB_DISABLE_SSL', false)
      && !optionalBoolean('DB_SSL_INTERNAL_NETWORK_ACKNOWLEDGED', false)) {
    errors.push('DB_DISABLE_SSL=true disables database TLS \u2014 set DB_SSL_INTERNAL_NETWORK_ACKNOWLEDGED=true to confirm Postgres is container-internal on a private network');
  }

  // CORS_ORIGIN is an allowlist input; a localhost value in production is a
  // copy-pasted dev template.
  if (config.security.corsOrigin && config.security.corsOrigin.includes('localhost')) {
    errors.push('CORS_ORIGIN must not contain localhost in production');
  }

  // ── Provider gaps: fatal normally, warnings under ALLOW_INSECURE_PROD ──
  const providerBucket = allowInsecureProd ? warnings : errors;

  // Razorpay webhook secret must be set so signature verification works
  if (!config.razorpay.webhookSecret) {
    providerBucket.push('RAZORPAY_WEBHOOK_SECRET must be set in production');
  }

  // SMS_PROVIDER and SMS_API_KEY must be real (not dev mode) in production
  if (!config.sms.provider || config.sms.provider === 'dev') {
    providerBucket.push('SMS_PROVIDER must be set to a real provider (e.g., fast2sms, msg91) in production — not dev mode');
  }
  if (!config.sms.apiKey) {
    providerBucket.push('SMS_API_KEY must be set in production for OTP delivery');
  }

  // Email must be configured (needed for OTP, password reset, security alerts,
  // verification + subscription confirmations). Resend (RESEND_API_KEY) OR real
  // SMTP creds satisfy this.
  if (!config.email.isConfigured()) {
    providerBucket.push('Email is not configured — set RESEND_API_KEY (recommended) or real EMAIL_USER/EMAIL_PASSWORD (SMTP) in production');
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  ALLOW_INSECURE_PROD is ON — running with unconfigured providers (PRE-LAUNCH ONLY):\n');
    warnings.forEach(w => console.warn(`  ! ${w}`));
    console.warn('\nThese MUST be resolved before onboarding real users.\n');
  }

  if (errors.length > 0) {
    console.error('\n🚨 PRODUCTION STARTUP BLOCKED — critical env vars missing or using placeholders:\n');
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('\nFix the above issues before starting in production.\n');
    process.exit(1);
  }
}

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
