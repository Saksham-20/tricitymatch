/**
 * Centralized Input Validation Schemas
 * Using express-validator for consistent validation
 */

const { body, param, query } = require('express-validator');
const { NAME_PATTERN } = require('../constants/names');
const { canonicalEmail } = require('../utils/emailAddress');
const { passwordField } = require('../utils/passwordPolicy');
const { marriageableAgeProblem } = require('../constants/marriageableAge');
const { PROFILE_STRIPPER_ALLOWLIST } = require('../constants/profileFields');
const { PURCHASABLE_PLANS } = require('../constants/plans');

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
    .customSanitizer(canonicalEmail)
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  // Single-use proofs returned by verify-otp; the controller checks them.
  // Explicit, request-borne acceptance. Signup used to stamp consent for ANY
  // request that got this far, so a direct API call or an old client was recorded
  // as having accepted a checkbox it never saw.
  body('termsAccepted')
    .custom((v) => v === true || v === 'true')
    .withMessage('Please accept the Terms and Privacy Policy to create an account'),
  body('marketingConsent').optional({ nullable: true }).isBoolean().withMessage('marketingConsent must be true or false'),
  body('creatingFor')
    .optional({ checkFalsy: true })
    .isIn(['self', 'other', 'parent', 'sibling', 'child', 'relative', 'friend'])
    .withMessage('Invalid value for who the profile is for'),
  body('relationshipToProfile')
    .optional({ checkFalsy: true })
    .isIn(['parent', 'sibling', 'child', 'relative', 'friend', 'other'])
    .withMessage('Invalid relationship'),
  body('subjectAttestation').optional({ nullable: true }).isBoolean().withMessage('subjectAttestation must be true or false'),
  body(['emailProof', 'phoneProof'])
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 128 })
    .withMessage('Invalid verification proof'),
  passwordField('password'),
  // firstName/lastName are OPTIONAL at signup: the web flow collects them on the
  // CreateAccount step and sends them here, but the mobile app creates the account
  // first and collects the name during onboarding Step 1 (PUT /profile/me). When
  // present they must still be valid; when absent the profile name is filled later.
  body('firstName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .matches(NAME_PATTERN)
    .withMessage('First name can only contain letters, spaces, hyphens, apostrophes and full stops'),
  body('lastName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(NAME_PATTERN)
    .withMessage('Last name can only contain letters, spaces, hyphens, apostrophes and full stops'),
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
    .custom((value, { req }) => {
      const problem = marriageableAgeProblem(req.body.gender, value);
      if (problem) throw new Error(problem);
      return true;
    }),
  // Member invite token (Phase S). Optional and non-blocking BY DESIGN: an
  // invalid, forged or expired invite is silently ignored and the signup
  // proceeds — it must never be a reason a real person cannot register. The
  // controller re-validates the inviter against the DB; this only bounds the
  // shape so a junk value never reaches a query.
  // NOTE the param name: `invite`, NOT `ref` — `ref`/`referralCode` belong to
  // the marketing referral flow and are honoured independently.
  body('invite')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 128 })
    .withMessage('Invalid invite link'),
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
  body('mfaCode')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 20 })
    .withMessage('Invalid code'),
];

const changeEmailRequestValidation = [
  body('newEmail')
    .isEmail()
    .withMessage('Please provide a valid email')
    .customSanitizer(canonicalEmail)
    .isLength({ max: 255 }),
  body('password')
    .optional({ checkFalsy: true })
    .isString(),
];

const changeEmailVerifyValidation = [
  body('newEmail')
    .isEmail()
    .withMessage('Please provide a valid email')
    .customSanitizer(canonicalEmail),
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
    .customSanitizer(canonicalEmail),
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isJWT()
    .withMessage('Invalid reset token format'),
  passwordField('password'),
];

// Phone-OTP password reset (accounts that have no verified email to receive a link).
const phoneResetRequestValidation = [
  body('phone').isString().withMessage('Enter your mobile number').isLength({ min: 10, max: 16 }).withMessage('Enter a valid mobile number'),
];

const phoneResetSubmitValidation = [
  body('phone').isString().isLength({ min: 10, max: 16 }).withMessage('Enter a valid mobile number'),
  body('code').isString().isNumeric().isLength({ min: 4, max: 6 }).withMessage('Enter the code we sent'),
  passwordField('password'),
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
    .matches(NAME_PATTERN)
    .withMessage('First name can only contain letters, spaces, hyphens, apostrophes and full stops'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(NAME_PATTERN)
    .withMessage('Last name can only contain letters, spaces, hyphens, apostrophes and full stops'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),
  body('dateOfBirth')
    .optional({ checkFalsy: true })
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
  body('preferredHeightMin')
    .optional({ checkFalsy: true })
    .isInt({ min: 100, max: 250 })
    .withMessage('Preferred minimum height must be between 100-250 cm'),
  body('preferredHeightMax')
    .optional({ checkFalsy: true })
    .isInt({ min: 100, max: 250 })
    .withMessage('Preferred maximum height must be between 100-250 cm')
    .custom((value, { req }) => {
      const min = req.body?.preferredHeightMin;
      if (min !== undefined && min !== '' && Number(min) > Number(value)) {
        throw new Error('Preferred minimum height cannot exceed the maximum');
      }
      return true;
    }),
  body('spotifyPlaylist').optional().trim().isLength({ max: 255 }).withMessage('Spotify link is too long (255 characters max)'),
  body('personalityType').optional().trim().isLength({ max: 255 }).withMessage('Personality type is too long (255 characters max)'),
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
  // NRI / living abroad
  body('isNri').optional().isBoolean().withMessage('isNri must be a boolean'),
  body('excludeSameGotra').optional().isBoolean().withMessage('excludeSameGotra must be a boolean'),
  body('residenceCountry').optional().trim().isLength({ max: 60 }).withMessage('Residence country too long'),
  body('residenceStatus').optional().trim().isLength({ max: 60 }).withMessage('Residence status too long'),
  body('familyLocation').optional().trim().isLength({ max: 120 }).withMessage('Family location too long'),
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
  body('brothers')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 15 }).withMessage('Brothers must be 0-15').toInt(),
  body('sisters')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 15 }).withMessage('Sisters must be 0-15').toInt(),
  body('willingToRelocate')
    .optional({ checkFalsy: true })
    .isIn(['yes', 'no', 'maybe']).withMessage('Invalid relocation answer'),
  body('livingArrangement')
    .optional({ checkFalsy: true })
    .isIn(['with_family', 'alone', 'with_roommates']).withMessage('Invalid living arrangement'),
  body('familyValues')
    .optional({ checkFalsy: true })
    .isIn(['traditional', 'moderate', 'liberal']).withMessage('Invalid family values'),
  body('nationality').optional().trim().isLength({ max: 60 }).withMessage('Nationality too long'),
  body('institution').optional().trim().isLength({ max: 120 }).withMessage('Institution too long'),
  body('industry').optional().trim().isLength({ max: 60 }).withMessage('Industry too long'),
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
    .isIn(['like', 'shortlist', 'pass', 'undo'])
    .withMessage('Action must be like, shortlist, pass, or undo'),
  // D3 like-with-note (optional; only honoured with action 'like' — the
  // controller sanitizes the note and validates likedItem against the target
  // profile, storing a content snapshot, never an index)
  body('note')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 280 })
    .withMessage('Note must be at most 280 characters'),
  body('likedItem')
    .optional({ values: 'falsy' })
    .isObject()
    .withMessage('likedItem must be an object'),
  body('likedItem.type')
    .optional()
    .isIn(['photo', 'prompt'])
    .withMessage('likedItem.type must be photo or prompt'),
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
  // D2 quote-reply (optional; premium + pair-membership enforced in controller)
  body('replyToId')
    .optional({ values: 'falsy' })
    .isUUID(4)
    .withMessage('replyToId must be a valid UUID'),
];

// D2 reactions — emoji membership in REACTION_EMOJIS is enforced in the
// controller (single source of truth in constants/chat.js); this only shapes.
const reactionValidation = [
  param('messageId')
    .isUUID(4)
    .withMessage('Message ID must be a valid UUID'),
  body('emoji')
    .isString()
    .withMessage('emoji is required')
    .isLength({ min: 1, max: 8 })
    .withMessage('emoji must be a single emoji'),
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
  // Not escaped: the value goes to a parameterised query, and HTML-escaping
  // turned the group labels the filter offers ("Software / IT") into
  // "Software &#x2F; IT", which then matched nothing exact.
  query('profession')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  query('showPassed')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('showPassed must be true or false'),
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
  // Neither of these was validated, so `?interestTags[0][x]=1` put an object
  // into a Postgres array-overlap parameter and returned a 500.
  query('interestTags')
    .optional()
    .customSanitizer((value) => (Array.isArray(value) ? value : [value]))
    .custom((tags) => tags.every((t) => typeof t === 'string' && t.length > 0 && t.length <= 50))
    .withMessage('interestTags must be strings of at most 50 characters'),
  query('interestTags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 }),
  query('verifiedOnly')
    .optional()
    .isBoolean()
    .withMessage('verifiedOnly must be a boolean')
    .toBoolean(),
];

// ==================== SUBSCRIPTION VALIDATORS ====================

// PURCHASABLE_PLANS, not PAID_PLANS: `founding_premium` is a granted
// entitlement with no price, so posting it here must 400 at validation rather
// than reach Razorpay (which has no order for it) and 500.
const createOrderValidation = [
  body('planType')
    .isIn(PURCHASABLE_PLANS)
    .withMessage(`Plan type must be one of: ${PURCHASABLE_PLANS.join(', ')}`),
  body('referralCode')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 32 })
    .withMessage('Invalid referral code'),
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

// Accounts an admin creates on someone's behalf were validated by nothing: the
// controllers only checked the fields were present, so "a" was an acceptable
// password for a member AND for an admin. Members get the signup rule; staff
// accounts (whose compromise is far worse) also need 12 characters.
const strongPassword = (minLength) => passwordField('password', { minLength });

// An assisted signup is a real member: gender and date of birth are theirs to
// give, not ours to invent (the form used to write 'other' / 1990-01-01, which
// the identity lock then froze onto the profile).
const adminCreateUserValidation = [
  body('email').isEmail().withMessage('Please provide a valid email').customSanitizer(canonicalEmail),
  strongPassword(8),
  body('firstName').isString().trim().isLength({ min: 1, max: 50 }).withMessage('First name is required'),
  body('lastName').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required'),
  body('gender').isIn(['male', 'female']).withMessage('Choose the member\'s gender'),
  body('dateOfBirth').isISO8601({ strict: true }).withMessage('Enter the member\'s date of birth'),
];

const adminCreateAdminValidation = [
  body('email').isEmail().withMessage('Please provide a valid email').customSanitizer(canonicalEmail),
  strongPassword(12),
];

// Marketing staff see leads' contact details and commission figures, so they get
// the admin-grade 12-character rule, not the 8-character member one — and the
// same canonical email as every other account.
const adminCreateMarketingUserValidation = [
  body('email').isEmail().withMessage('Please provide a valid email').customSanitizer(canonicalEmail),
  strongPassword(12),
  body('firstName').isString().trim().isLength({ min: 1, max: 50 }).withMessage('firstName is required'),
  body('lastName').isString().trim().isLength({ min: 1, max: 50 }).withMessage('lastName is required'),
  body('role').optional().isIn(['marketing', 'marketing_manager']).withMessage('role must be marketing or marketing_manager'),
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
    .isIn(['user', 'sub_admin', 'admin', 'super_admin', 'marketing_manager', 'marketing']),
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

// A photo stored on local disk (dev, or before Cloudinary was configured) is a
// relative `/uploads/...` path that isURL() rejects, which left it undeletable.
// The controller only ever removes a URL already on the member's own profile.
const deletePhotoValidation = [
  body('photoUrl')
    .isString()
    .withMessage('Photo URL is required')
    .bail()
    .notEmpty()
    .withMessage('Photo URL is required')
    .bail()
    .if((value) => !/^\/uploads\/[^\s?#]+$/.test(value))
    .isURL()
    .withMessage('Invalid photo URL'),
];

// ==================== CONTACT VALIDATOR ====================
// Public contact form and success-story submission. Free text is stored AS TYPED
// and escaped where it is rendered (React, the email templates, the support
// notification in contactController). Escaping on write stored entities
// ("it&#x27;s", "R&amp;D") that every renderer then escaped a second time (SITE-07).
// Length bounds still apply; success stories land as status:'draft' for review.
const successStoryValidation = [
  body('coupleNames')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Couple names are too long'),
  body('groomName')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 120 }).withMessage('Name is too long'),
  body('brideName')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 120 }).withMessage('Name is too long'),
  body('quote')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 5000 }).withMessage('Story must be at most 5000 characters'),
  body('story')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 5000 }).withMessage('Story must be at most 5000 characters'),
  body('location')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Location is too long'),
  body('marriedOn')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Wedding date must be a valid date').toDate(),
  body('weddingDate')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Wedding date must be a valid date').toDate(),
];

const contactValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .customSanitizer(canonicalEmail),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Phone is too long'),
  body('subject')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Subject is too long'),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Message must be 10–2000 characters'),
];

module.exports = {
  // Auth
  signupValidation,
  contactValidation,
  successStoryValidation,
  loginValidation,
  changeEmailRequestValidation,
  changeEmailVerifyValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  phoneResetRequestValidation,
  phoneResetSubmitValidation,
  refreshTokenValidation,
  // Profile
  updateProfileValidation,
  getProfileValidation,
  deletePhotoValidation,
  // Match
  matchActionValidation,
  // Chat
  sendMessageValidation,
  reactionValidation,
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
  adminCreateUserValidation,
  adminCreateAdminValidation,
  adminCreateMarketingUserValidation,
  updateVerificationValidation,
  adminSearchValidation,
  // Verification
  submitVerificationValidation,
  // Helpers
  isUUID,
  allowedProfileFields,
};
