const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { createOrder, verifyPayment, getMySubscription, getPlans, webhook } = require('../controllers/subscriptionController');
const { auth } = require('../middlewares/auth');

router.post('/create-order', auth, createOrder);
router.post('/verify-payment', auth, verifyPayment);
router.get('/my-subscription', auth, getMySubscription);
router.get('/plans', getPlans);

// Secure webhook with signature verification
router.post('/webhook', (req, res, next) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  if (!secret) {
    return res.status(500).json({ message: 'Webhook secret not configured' });
  }

  if (!signature) {
    return res.status(401).json({ message: 'Missing webhook signature' });
  }

  // Use raw body captured by middleware in server.js for signature verification
  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(500).json({ message: 'Raw body not available for signature verification' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ message: 'Invalid webhook signature' });
  }

  next();
}, webhook);

module.exports = router;

