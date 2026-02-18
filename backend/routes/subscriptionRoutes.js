/**
 * Subscription Routes
 * Payment and subscription management endpoints
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { 
  createOrder, 
  verifyPayment, 
  getMySubscription, 
  getPlans, 
  webhook 
} = require('../controllers/subscriptionController');
const { auth } = require('../middlewares/auth');
const { handleValidationErrors, createError } = require('../middlewares/errorHandler');
const { createRateLimiter } = require('../middlewares/security');
const { createOrderValidation, verifyPaymentValidation } = require('../validators');
const config = require('../config/env');

// Rate limiter for payment operations
const paymentLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: 'Too many payment attempts, please try again later',
});

// ==================== PUBLIC ROUTES ====================

// Get available plans (public)
router.get('/plans', getPlans);

// Webhook for Razorpay (public, but verified)
router.post('/webhook', (req, res, next) => {
  const secret = config.razorpay.webhookSecret;
  const signature = req.headers['x-razorpay-signature'];

  // Check if webhook is configured
  if (!secret) {
    console.warn('Webhook secret not configured');
    return res.status(500).json({ 
      success: false,
      error: { message: 'Webhook not configured' }
    });
  }

  // Verify signature
  if (!signature) {
    return res.status(401).json({ 
      success: false,
      error: { message: 'Missing webhook signature' }
    });
  }

  // Use raw body for signature verification
  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(500).json({ 
      success: false,
      error: { message: 'Raw body not available' }
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn('Invalid webhook signature');
    return res.status(401).json({ 
      success: false,
      error: { message: 'Invalid webhook signature' }
    });
  }

  next();
}, webhook);

// ==================== PROTECTED ROUTES ====================

// Get current subscription
router.get('/my-subscription', auth, getMySubscription);

// Create payment order
router.post('/create-order', 
  auth,
  paymentLimiter,
  createOrderValidation,
  handleValidationErrors,
  createOrder
);

// Verify payment
router.post('/verify-payment', 
  auth,
  paymentLimiter,
  verifyPaymentValidation,
  handleValidationErrors,
  verifyPayment
);

module.exports = router;
