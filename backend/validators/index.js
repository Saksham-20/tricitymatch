/**
 * Centralized Input Validation Schemas
 * Using express-validator for consistent validation
 */

const { body, param, query } = require('express-validator');

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
  body('email')
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
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
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
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
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
    .notEmpty()
    .withMessage('Refresh token is required'),
];

// ==================== PROFILE VALIDATORS ====================

const allowedProfileFields = [
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'height', 'weight',
  'city', 'state', 'skinTone', 'diet', 'smoking', 'drinking',
  'education', 'degree', 'profession', 'income',
  'preferredAgeMin', 'preferredAgeMax', 'preferredHeightMin', 'preferredHeightMax',
  'preferredEducation', 'preferredProfession', 'preferredCity',
  'personalityValues', 'familyPreferences', 'lifestylePreferences',
  'bio', 'showPhone', 'showEmail', 'interestTags', 'profilePrompts',
  'spotifyPlaylist', 'socialMediaLinks', 'personalityType', 'languages',
  'incognitoMode', 'photoBlurUntilMatch'
];

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
    .optional()
    .isInt({ min: 100, max: 250 })
    .withMessage('Height must be between 100-250 cm'),
  body('weight')
    .optional()
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
    .optional()
    .isIn(['fair', 'wheatish', 'dark'])
    .withMessage('Invalid skin tone'),
  body('diet')
    .optional()
    .isIn(['vegetarian', 'non-vegetarian', 'vegan', 'jain'])
    .withMessage('Invalid diet preference'),
  body('smoking')
    .optional()
    .isIn(['never', 'occasionally', 'regularly'])
    .withMessage('Invalid smoking preference'),
  body('drinking')
    .optional()
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
    .optional()
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Invalid income value'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must not exceed 1000 characters'),
  body('preferredAgeMin')
    .optional()
    .isInt({ min: 18, max: 99 })
    .withMessage('Preferred age min must be 18-99'),
  body('preferredAgeMax')
    .optional()
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
  // Sanitize to only allow whitelisted fields
  body()
    .custom((value, { req }) => {
      const receivedFields = Object.keys(req.body);
      const invalidFields = receivedFields.filter(f => !allowedProfileFields.includes(f));
      if (invalidFields.length > 0) {
        throw new Error(`Invalid fields: ${invalidFields.join(', ')}`);
      }
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
    .toInt(),
  query('heightMin')
    .optional()
    .isInt({ min: 100, max: 250 })
    .withMessage('Height min must be 100-250')
    .toInt(),
  query('heightMax')
    .optional()
    .isInt({ min: 100, max: 250 })
    .withMessage('Height max must be 100-250')
    .toInt(),
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
    .isIn(['compatibility', 'createdAt', 'lastLogin'])
    .withMessage('Invalid sort option'),
];

// ==================== SUBSCRIPTION VALIDATORS ====================

const createOrderValidation = [
  body('planType')
    .isIn(['premium', 'elite'])
    .withMessage('Plan type must be premium or elite'),
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
    .isIn(['approved', 'rejected', 'flagged'])
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
    .isIn(['active', 'inactive', 'banned', 'pending']),
  query('role')
    .optional()
    .isIn(['user', 'admin']),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
];

// ==================== VERIFICATION VALIDATORS ====================

const submitVerificationValidation = [
  body('documentType')
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

module.exports = {
  // Auth
  signupValidation,
  loginValidation,
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
