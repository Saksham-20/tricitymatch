/**
 * Subscription Routes
 * Payment and subscription management endpoints
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const {
  createOrder,
  cancelOrder,
  verifyPayment,
  getMySubscription,
  getPlans,
  webhook,
  getPaymentHistory,
  getInvoice,
  cancelSubscription,
  createBundleOrder,
  verifyBundlePayment,
  verifyGooglePlay,
  claimFounding,
  getReferral,
  checkReferral,
} = require('../controllers/subscriptionController');
const { auth, requirePremium } = require('../middlewares/auth');
const { handleValidationErrors, createError } = require('../middlewares/errorHandler');
const { createRateLimiter } = require('../middlewares/security');
const { createOrderValidation, verifyPaymentValidation } = require('../validators');
const { body: evBody } = require('express-validator');
const { UNLOCK_BUNDLES } = require('../utils/razorpay');
const config = require('../config/env');

// Rate limiter for payment operations
const paymentLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: 'Too many payment attempts, please try again later',
});

// Confirming or closing an order that already exists is not an attempt to buy
// anything. verify-payment is signature-gated and idempotent, and cancel-order
// only ever closes the caller's own order, so neither needs the tight budget
// that exists to stop order minting. Sharing it made two abandoned checkouts
// cost four of the ten hourly hits (create + cancel each), leaving a member
// who finally paid with no budget left to confirm it.
const confirmLimiter = createRateLimiter({
  name: 'paymentConfirmLimiter',
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: 'Too many payment confirmations, please try again later',
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

// Claim the founding-member grant. Rate-limited on the payment limiter even
// though no money moves: it mints an entitlement, and the member cap is a
// read-then-insert count, so an unthrottled endpoint is the one way to make
// the cap overshoot meaningfully.
router.post('/claim-founding', auth, paymentLimiter, claimFounding);

// Referral panel (own code, stats, prefill) and a code preview. The preview is a
// guessing surface for codes, so it is limited — but on its OWN budget: sharing
// the 10/hr payment limiter meant a few mistyped codes could lock a buyer out of
// the payment itself.
const referralCheckLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: 'Too many referral code checks, please try again later',
});
router.get('/referral', auth, getReferral);
router.post('/referral/check',
  auth,
  referralCheckLimiter,
  evBody('code').isString().trim().isLength({ min: 3, max: 32 }).withMessage('Enter a referral code'),
  evBody('planType').isString().isLength({ max: 32 }),
  handleValidationErrors,
  checkReferral
);

// Create payment order
router.post('/create-order', 
  auth,
  paymentLimiter,
  createOrderValidation,
  handleValidationErrors,
  createOrder
);

// The member closed the payment popup without paying — closes the order so it
// does not sit in `pending`. Idempotent; see controller for the rules.
router.post('/cancel-order',
  auth,
  confirmLimiter,
  evBody('razorpayOrderId').isString().trim().notEmpty().isLength({ max: 64 })
    .withMessage('Invalid order'),
  handleValidationErrors,
  cancelOrder
);

// Verify payment
router.post('/verify-payment',
  auth,
  confirmLimiter,
  verifyPaymentValidation,
  handleValidationErrors,
  verifyPayment
);

// Verify a Google Play subscription purchase (Android user-choice billing)
router.post('/google-verify',
  auth,
  paymentLimiter,
  evBody('productId').isString().trim().notEmpty().withMessage('productId required'),
  evBody('purchaseToken').isString().trim().notEmpty().withMessage('purchaseToken required'),
  handleValidationErrors,
  verifyGooglePlay
);

// ---- À-la-carte contact-unlock top-ups (require an active finite paid plan) ----
router.post('/unlock-bundle/create-order',
  auth,
  paymentLimiter,
  requirePremium,
  evBody('bundleId').isIn(Object.keys(UNLOCK_BUNDLES)).withMessage('Invalid bundle'),
  handleValidationErrors,
  createBundleOrder
);

router.post('/unlock-bundle/verify-payment',
  auth,
  confirmLimiter,
  requirePremium,
  verifyPaymentValidation,
  handleValidationErrors,
  verifyBundlePayment
);

// Cancel active subscription. No automatic refund is issued — see
// controllers/subscriptionController.js cancelSubscription for why. Kept on
// paymentLimiter (not just the global limiter): it still ends a paid
// entitlement and cancel/repurchase churn is worth rate-limiting on its own.
router.delete('/current', auth, paymentLimiter, cancelSubscription);

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
