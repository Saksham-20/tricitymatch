const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { signup, login, getMe } = require('../controllers/authController');
const { auth } = require('../middlewares/auth');

// Validation rules
const signupValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('dateOfBirth').optional().isISO8601().withMessage('Invalid date of birth')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.get('/me', auth, getMe);

module.exports = router;

