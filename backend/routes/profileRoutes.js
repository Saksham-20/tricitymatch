const express = require('express');
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const {
  getMyProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  verifyIdentity,
  getProfileById,
  getProfileCompletion,
  updatePreferences
} = require('../controllers/profileController');
const { authMiddleware, premiumMiddleware } = require('../middlewares/authMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Validation rules
const profileUpdateValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('height').optional().isInt({ min: 120, max: 220 }),
  body('weight').optional().isInt({ min: 30, max: 200 }),
  body('bio').optional().isLength({ max: 500 }),
  body('religion').optional().trim(),
  body('caste').optional().trim(),
  body('community').optional().trim(),
  body('education').optional().trim(),
  body('profession').optional().trim(),
  body('income').optional().isInt({ min: 0 }),
  body('city').optional().trim(),
  body('skinTone').optional().isIn(['fair', 'wheatish', 'dark', 'very fair']),
  body('diet').optional().isIn(['vegetarian', 'non-vegetarian', 'vegan', 'jain']),
  body('smoking').optional().isIn(['yes', 'no', 'occasionally']),
  body('drinking').optional().isIn(['yes', 'no', 'occasionally']),
  body('birthTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('birthPlace').optional().trim()
];

const preferencesValidation = [
  body('ageMin').optional().isInt({ min: 18, max: 80 }),
  body('ageMax').optional().isInt({ min: 18, max: 80 }),
  body('heightMin').optional().isInt({ min: 120, max: 220 }),
  body('heightMax').optional().isInt({ min: 120, max: 220 }),
  body('incomeMin').optional().isInt({ min: 0 }),
  body('incomeMax').optional().isInt({ min: 0 }),
  body('religion').optional().trim(),
  body('caste').optional().trim(),
  body('education').optional().trim(),
  body('profession').optional().trim(),
  body('city').optional().trim(),
  body('diet').optional().isIn(['vegetarian', 'non-vegetarian', 'vegan', 'jain', 'any']),
  body('smoking').optional().isIn(['yes', 'no', 'occasionally', 'any']),
  body('drinking').optional().isIn(['yes', 'no', 'occasionally', 'any']),
  body('kundliMatch').optional().isBoolean()
];

// Routes
router.get('/me', getMyProfile);
router.put('/update', profileUpdateValidation, updateProfile);
router.post('/upload-photo', uploadLimiter, upload.single('photo'), uploadPhoto);
router.delete('/photo/:photoId', deletePhoto);
router.post('/verify-identity', uploadLimiter, upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), verifyIdentity);
router.get('/completion', getProfileCompletion);
router.put('/preferences', preferencesValidation, updatePreferences);
router.get('/:id', getProfileById);

module.exports = router;
