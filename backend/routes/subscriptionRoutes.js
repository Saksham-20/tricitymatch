const express = require('express');
const { body } = require('express-validator');
const {
  createOrder,
  verifyPayment,
  getSubscriptionStatus,
  getPaymentHistory,
  cancelSubscription,
  createBoostOrder,
  verifyBoostPayment
} = require('../controllers/subscriptionController');
const { authMiddleware, premiumMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Validation rules
const createOrderValidation = [
  body('plan').isIn(['premium', 'elite']).withMessage('Valid plan required'),
  body('duration').isIn([30, 90, 365]).withMessage('Valid duration required (30, 90, or 365 days)')
];

const verifyPaymentValidation = [
  body('orderId').notEmpty().withMessage('Order ID required'),
  body('paymentId').notEmpty().withMessage('Payment ID required'),
  body('signature').notEmpty().withMessage('Signature required')
];

const createBoostOrderValidation = [
  body('duration').isIn([24, 72, 168]).withMessage('Valid duration required (24, 72, or 168 hours)')
];

// Routes
router.post('/create-order', authMiddleware, createOrderValidation, createOrder);
router.post('/verify-payment', authMiddleware, verifyPaymentValidation, verifyPayment);
router.get('/status', authMiddleware, getSubscriptionStatus);
router.get('/payment-history', authMiddleware, getPaymentHistory);
router.post('/cancel', authMiddleware, premiumMiddleware, cancelSubscription);
router.post('/boost/create-order', authMiddleware, createBoostOrderValidation, createBoostOrder);
router.post('/boost/verify-payment', authMiddleware, verifyPaymentValidation, verifyBoostPayment);

module.exports = router;
