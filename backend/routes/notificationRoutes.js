/**
 * Notification Routes
 */

const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { auth } = require('../middlewares/auth');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/errorHandler');

const notifIdParam = [
  param('id').isUUID(4).withMessage('Invalid notification ID'),
  handleValidationErrors,
];

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.put('/read-all', auth, markAllRead);
router.put('/:id/read', auth, notifIdParam, markRead);
router.delete('/:id', auth, notifIdParam, deleteNotification);

module.exports = router;
