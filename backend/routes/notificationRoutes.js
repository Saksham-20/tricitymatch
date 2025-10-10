const express = require('express');
const { query } = require('express-validator');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
} = require('../controllers/notificationController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation rules
const notificationsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('type').optional().isIn([
    'profile_view',
    'like',
    'message',
    'match',
    'reminder',
    'subscription_expiry',
    'boost_expiry',
    'verification_approved',
    'verification_rejected',
    'admin_message'
  ]),
  query('isRead').optional().isBoolean()
];

// Routes
router.get('/', notificationsValidation, getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
