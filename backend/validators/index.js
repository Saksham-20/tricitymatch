/**
 * Centralized Input Validation Schemas
 * Using express-validator for consistent validation
 */

const { body, param, query } = require('express-validator');
const { PROFILE_STRIPPER_ALLOWLIST } = require('../constants/profileFields');
const { PAID_PLANS } = require('../constants/plans');

// Common validation helpers
const isUUID = (field, location = 'param') => {
  const validator = location === 'param' ? param(field) : 
                   location === 'query' ? query(field) : body(field);
  return validator
    .isUUID(4)
    .withMessage(`${field} must be a valid UUID`);
};

const _sanitizeString = (field) => {
  return body(field)
    .trim()
    .escape()
    .stripLow(true);
};

const paginationRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

// ==================== AUTH VALIDATORS ====================

const signupValidation = [
  // Flexible auth: an account needs EITHER a valid email OR a valid phone.
  body()
    .custom((_, { req }) => {
      if (!req.body.email && !req.body.phone) {
        throw new Error('An email address or phone number is required');
      }
      return true;
    }),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  // firstName/lastName are OPTIONAL at signup: the web flow collects them on the
  // CreateAccount step and sends them here, but the mobile app creates the account
  // first and collects the name during onboarding Step 1 (PUT /profile/me). When
  // present they must still be valid; when absent the profile name is filled later.
  body('firstName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian mobile number'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date of birth format')
    .custom((value) => {
      const dob = new Date(value);
      const today = new Date();
      const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) {
        throw new Error('You must be at least 18 years old');
      }
      if (age > 120) {
        throw new Error('Invalid date of birth');
      }
      return true;
    }),
];

const loginValidation = [
  // Flexible auth: `identifier` is an email or phone (legacy `email` still accepted).
  body()
    .custom((_, { req }) => {
      const id = (req.body.identifier ?? req.body.email ?? '').toString().trim();
      if (!id) throw new Error('Email or phone number is required');
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const changeEmailRequestValidation = [
  body('newEmail')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 }),
  body('password')
    .optional({ checkFalsy: true })
    .isString(),
];

const changeEmailVerifyValidation = [
  body('newEmail')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('code')
    .isLength({ min: 4, max: 6 })
    .withMessage('Code must be 4–6 digits')
    .isNumeric()
    .withMessage('Code must be numeric'),
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isJWT()
    .withMessage('Invalid reset token format'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
];

const refreshTokenValidation = [
  body('refreshToken')
    .optional()
    .notEmpty()
    .withMessage('Refresh token must not be empty when provided'),
  body()
    .custom((_, { req }) => {
      const fromBody = req.body?.refreshToken;
      const fromCookie = req.cookies?.refreshToken;
      if (fromBody || fromCookie) return true;
      throw new Error('Refresh token is required (send in body or cookie)');
    }),
];

// ==================== PROFILE VALIDATORS ====================

// Derived from the single source of truth (backend/constants/profileFields.js)
// so the stripper can never drift out of sync with the controller's update loop
// again. Includes profilePhoto/photos so the controller can read them post-strip.
const allowedProfileFields = PROFILE_STRIPPER_ALLOWLIST;

const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('height')
    .optional({ checkFalsy: true })
    .isInt({ min: 100, max: 250 })
    .withMessage('Height must be between 100-250 cm'),
  body('weight')
    .optional({ checkFalsy: true })
    .isInt({ min: 30, max: 300 })
    .withMessage('Weight must be between 30-300 kg'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  body('skinTone')
    .optional({ checkFalsy: true })
    .isIn(['fair', 'wheatish', 'dark'])
    .withMessage('Invalid skin tone'),
  body('diet')
    .optional({ checkFalsy: true })
    .isIn(['vegetarian', 'non-vegetarian', 'vegan', 'jain'])
    .withMessage('Invalid diet preference'),
  body('smoking')
    .optional({ checkFalsy: true })
    .isIn(['never', 'occasionally', 'regularly'])
    .withMessage('Invalid smoking preference'),
  body('drinking')
    .optional({ checkFalsy: true })
    .isIn(['never', 'occasionally', 'regularly'])
    .withMessage('Invalid drinking preference'),
  body('education')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Education must not exceed 100 characters'),
  body('profession')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Profession must not exceed 100 characters'),
  body('income')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Invalid income value'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must not exceed 1000 characters'),
  body('preferredAgeMin')
    .optional({ checkFalsy: true })
    .isInt({ min: 18, max: 99 })
    .withMessage('Preferred age min must be 18-99'),
  body('preferredAgeMax')
    .optional({ checkFalsy: true })
    .isInt({ min: 18, max: 99 })
    .withMessage('Preferred age max must be 18-99'),
  body('interestTags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Interest tags must be an array with max 20 items'),
  body('interestTags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each interest tag must not exceed 50 characters'),
  body('languages')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Languages must be an array with max 10 items'),
  body('showPhone')
    .optional()
    .isBoolean()
    .withMessage('showPhone must be a boolean'),
  body('showEmail')
    .optional()
    .isBoolean()
    .withMessage('showEmail must be a boolean'),
  body('incognitoMode')
    .optional()
    .isBoolean()
    .withMessage('incognitoMode must be a boolean'),
  body('familyPreferences.children')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Desired children must be between 0 and 20'),
  // Religion & community (free text — length-capped, HTML-stripped in controller)
  body('religion').optional().trim().isLength({ max: 50 }).withMessage('Religion too long'),
  body('caste').optional().trim().isLength({ max: 100 }).withMessage('Caste must not exceed 100 characters'),
  body('subCaste').optional().trim().isLength({ max: 100 }).withMessage('Sub-caste too long'),
  body('gotra').optional().trim().isLength({ max: 100 }).withMessage('Gotra too long'),
  body('motherTongue').optional().trim().isLength({ max: 50 }).withMessage('Mother tongue too long'),
  // Marital — ENUM: reject bad values with 400 instead of a raw pg 500
  body('maritalStatus')
    .optional({ checkFalsy: true })
    .isIn(['never_married', 'divorced', 'widowed', 'awaiting_divorce'])
    .withMessage('Invalid marital status'),
  body('numberOfChildren')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 20 }).withMessage('Number of children must be 0-20').toInt(),
  // Horoscope / Kundli
  body('manglikStatus')
    .optional({ checkFalsy: true })
    .isIn(['manglik', 'non_manglik', 'anshik_manglik', 'not_sure'])
    .withMessage('Invalid Manglik status'),
  body('zodiacSign').optional().trim().isLength({ max: 30 }).withMessage('Zodiac sign too long'),
  body('rashi').optional().trim().isLength({ max: 30 }).withMessage('Rashi too long'),
  body('nakshatra').optional().trim().isLength({ max: 40 }).withMessage('Nakshatra too long'),
  body('placeOfBirth').optional().trim().isLength({ max: 100 }).withMessage('Place of birth too long'),
  body('birthTime').optional().trim().isLength({ max: 20 }).withMessage('Invalid birth time'),
  // Family — ENUMs + int
  body('familyType')
    .optional({ checkFalsy: true })
    .isIn(['joint', 'nuclear']).withMessage('Invalid family type'),
  body('familyStatus')
    .optional({ checkFalsy: true })
    .isIn(['middle_class', 'upper_middle_class', 'affluent', 'rich'])
    .withMessage('Invalid family status'),
  body('fatherOccupation').optional().trim().isLength({ max: 100 }).withMessage('Father occupation too long'),
  body('motherOccupation').optional().trim().isLength({ max: 100 }).withMessage('Mother occupation too long'),
  body('numberOfSiblings')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 20 }).withMessage('Number of siblings must be 0-20').toInt(),
  body('degree').optional().trim().isLength({ max: 100 }).withMessage('Degree too long'),
  body('preferredEducation').optional().trim().isLength({ max: 100 }).withMessage('Preferred education too long'),
  body('preferredProfession').optional().trim().isLength({ max: 100 }).withMessage('Preferred profession too long'),
  // Strip disallowed fields so client can send full profile (e.g. from GET); only allowed keys are kept
  body()
    .custom((value, { req }) => {
      const body = req.body || {};
      const allowed = new Set(allowedProfileFields);
      const stripped = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.has(key))
      );
      req.body = stripped;
      return true;
    }),
];

const getProfileValidation = [
  isUUID('userId', 'param'),
];

// ==================== MATCH VALIDATORS ====================

const matchActionValidation = [
  isUUID('userId', 'param'),
  body('action')
    .isIn(['like', 'shortlist', 'pass'])
    .withMessage('Action must be like, shortlist, or pass'),
];

// ==================== CHAT VALIDATORS ====================

const sendMessageValidation = [
  body('receiverId')
    .isUUID(4)
    .withMessage('Receiver ID must be a valid UUID'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 2000 })
    .withMessage('Message must not exceed 2000 characters'),
];

const editMessageValidation = [
  isUUID('messageId', 'param'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 2000 })
    .withMessage('Message must not exceed 2000 characters'),
];

const deleteMessageValidation = [
  isUUID('messageId', 'param'),
];

const getMessagesValidation = [
  isUUID('userId', 'param'),
];

// ==================== SEARCH VALIDATORS ====================

const searchValidation = [
  ...paginationRules,
  query('ageMin')
    .optional()
    .isInt({ min: 18, max: 99 })
    .withMessage('Age min must be 18-99')
    .toInt(),
  query('ageMax')
    .optional()
    .isInt({ min: 18, max: 99 })
    .withMessage('Age max must be 18-99')
    .toInt()
    .custom((value, { req }) => {
      // Cross-field: reject inverted range (ageMin must not exceed ageMax).
      const min = req.query.ageMin;
      if (min !== undefined && min !== '' && Number(min) > Number(value)) {
        throw new Error('ageMin must not exceed ageMax');
      }
      return true;
    }),
  query('heightMin')
    .optional()
    .isInt({ min: 100, max: 250 })
    .withMessage('Height min must be 100-250')
    .toInt(),
  query('heightMax')
    .optional()
    .isInt({ min: 100, max: 250 })
    .withMessage('Height max must be 100-250')
    .toInt()
    .custom((value, { req }) => {
      const min = req.query.heightMin;
      if (min !== undefined && min !== '' && Number(min) > Number(value)) {
        throw new Error('heightMin must not exceed heightMax');
      }
      return true;
    }),
  query('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  query('education')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  query('profession')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  query('diet')
    .optional()
    .isIn(['vegetarian', 'non-vegetarian', 'vegan', 'jain']),
  query('smoking')
    .optional()
    .isIn(['never', 'occasionally', 'regularly']),
  query('drinking')
    .optional()
    .isIn(['never', 'occasionally', 'regularly']),
  query('sortBy')
    .optional()
    .isIn(['compatibility', 'age', 'location', 'recent', 'createdAt', 'lastLogin'])
    .withMessage('Invalid sort option'),
  query('religion')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Religion must not exceed 100 characters'),
  query('caste')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Caste must not exceed 100 characters'),
  query('motherTongue')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Mother tongue must not exceed 100 characters'),
  query('maritalStatus')
    .optional()
    .isIn(['never_married', 'divorced', 'widowed', 'awaiting_divorce'])
    .withMessage('Invalid marital status'),
  query('incomeMin')
    .optional()
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Income min must be a non-negative integer')
    .toInt(),
  query('incomeMax')
    .optional()
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Income max must be a non-negative integer')
    .toInt(),
];

// ==================== SUBSCRIPTION VALIDATORS ====================

const createOrderValidation = [
  body('planType')
    .isIn(PAID_PLANS)
    .withMessage('Plan type must be one of: basic_premium, premium_plus, vip'),
];

const verifyPaymentValidation = [
  body('razorpayOrderId')
    .notEmpty()
    .withMessage('Razorpay order ID is required')
    .isString(),
  body('razorpayPaymentId')
    .notEmpty()
    .withMessage('Razorpay payment ID is required')
    .isString(),
  body('razorpaySignature')
    .notEmpty()
    .withMessage('Razorpay signature is required')
    .isString(),
];

// ==================== ADMIN VALIDATORS ====================

const updateUserStatusValidation = [
  isUUID('userId', 'param'),
  body('status')
    .isIn(['active', 'inactive', 'banned', 'pending'])
    .withMessage('Invalid status'),
];

const updateVerificationValidation = [
  isUUID('verificationId', 'param'),
  body('status')
    // 'pending' lets an admin re-open a decided verification for another look.
    .isIn(['approved', 'rejected', 'pending', 'flagged'])
    .withMessage('Invalid status'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must not exceed 1000 characters'),
];

const adminSearchValidation = [
  ...paginationRules,
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'banned', 'pending', 'deleted']),
  query('role')
    .optional()
    .isIn(['user', 'admin', 'super_admin', 'marketing_manager', 'marketing']),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
];

// ==================== VERIFICATION VALIDATORS ====================

// Photo (selfie) verification — no document fields collected. `documentType`
// is tolerated from stale clients but ignored server-side.
const submitVerificationValidation = [
  body('documentType')
    .optional()
    .isIn(['aadhaar', 'pan', 'passport', 'driving_license'])
    .withMessage('Invalid document type'),
];

// ==================== DELETE PHOTO VALIDATORS ====================

const deletePhotoValidation = [
  body('photoUrl')
    .notEmpty()
    .withMessage('Photo URL is required')
    .isURL()
    .withMessage('Invalid photo URL'),
];

// ==================== CONTACT VALIDATOR ====================
// Public contact form. Sanitize free-text (escape) since the message is stored
// and surfaced to admins / emailed — prevents stored XSS.
const contactValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters')
    .escape(),
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Phone is too long')
    .escape(),
  body('subject')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Subject is too long')
    .escape(),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Message must be 10–2000 characters')
    .escape(),
];

module.exports = {
  // Auth
  signupValidation,
  contactValidation,
  loginValidation,
  changeEmailRequestValidation,
  changeEmailVerifyValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  refreshTokenValidation,
  // Profile
  updateProfileValidation,
  getProfileValidation,
  deletePhotoValidation,
  // Match
  matchActionValidation,
  // Chat
  sendMessageValidation,
  editMessageValidation,
  deleteMessageValidation,
  getMessagesValidation,
  // Search
  searchValidation,
  paginationRules,
  // Subscription
  createOrderValidation,
  verifyPaymentValidation,
  // Admin
  updateUserStatusValidation,
  updateVerificationValidation,
  adminSearchValidation,
  // Verification
  submitVerificationValidation,
  // Helpers
  isUUID,
  allowedProfileFields,
};
