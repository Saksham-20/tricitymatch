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
  webhook,
  getPaymentHistory,
  getInvoice,
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

  // Webhook secret not configured — ack 200 to prevent Razorpay retry storm, log warning.
  if (!secret) {
    console.warn(JSON.stringify({ level: 'WARN', message: 'Webhook received but RAZORPAY_WEBHOOK_SECRET not configured — request discarded', timestamp: new Date().toISOString() }));
    return res.json({ success: true });
  }

  // Missing signature header — reject with 401 (not a retry candidate)
  if (!signature) {
    return res.status(401).json({ success: false, error: { message: 'Missing webhook signature' } });
  }

  // Raw body must be present (captured in server.js before JSON parsing)
  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error(JSON.stringify({ level: 'ERROR', message: 'Webhook raw body missing — check server.js raw body capture path', timestamp: new Date().toISOString() }));
    return res.status(500).json({ success: false, error: { message: 'Raw body not available' } });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signature.length === expectedSignature.length ? signature : '', 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');
  const signatureValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);
  if (!signatureValid) {
    console.warn(JSON.stringify({ level: 'WARN', message: 'Invalid webhook signature', timestamp: new Date().toISOString() }));
    return res.status(401).json({ success: false, error: { message: 'Invalid webhook signature' } });
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

// Payment history
router.get('/history', auth, getPaymentHistory);

// Download invoice PDF
const { param: evParam } = require('express-validator');
router.get('/invoice/:subscriptionId',
  auth,
  evParam('subscriptionId').isUUID(4).withMessage('Invalid subscription ID'),
  handleValidationErrors,
  getInvoice
);

module.exports = router;
