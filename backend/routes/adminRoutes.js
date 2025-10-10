const express = require('express');
const { body, query } = require('express-validator');
const {
  getUsers,
  getUserById,
  verifyUser,
  banUser,
  unbanUser,
  getReports,
  resolveReport,
  dismissReport,
  getAnalytics,
  getDashboardStats,
  sendNotificationToUser,
  getVerificationQueue
} = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authMiddleware, adminMiddleware);

// Validation rules
const userSearchValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('role').optional().isIn(['user', 'admin']),
  query('subscriptionType').optional().isIn(['free', 'premium', 'elite']),
  query('isActive').optional().isBoolean(),
  query('isVerified').optional().isBoolean()
];

const reportValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'reviewed', 'resolved', 'dismissed']),
  query('reason').optional().trim()
];

const analyticsValidation = [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
];

const banUserValidation = [
  body('reason').notEmpty().withMessage('Ban reason is required'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer')
];

const sendNotificationValidation = [
  body('userId').isUUID().withMessage('Valid user ID required'),
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('type').optional().isIn(['admin_message', 'system_notification'])
];

// Routes
router.get('/users', userSearchValidation, getUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/ban', banUserValidation, banUser);
router.put('/users/:id/unban', unbanUser);
router.get('/reports', reportValidation, getReports);
router.put('/reports/:id/resolve', resolveReport);
router.put('/reports/:id/dismiss', dismissReport);
router.get('/analytics', analyticsValidation, getAnalytics);
router.get('/dashboard', getDashboardStats);
router.post('/notifications/send', sendNotificationValidation, sendNotificationToUser);
router.get('/verification-queue', getVerificationQueue);

module.exports = router;
