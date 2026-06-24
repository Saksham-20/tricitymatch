const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/env');

// Lazy initialization - only create Razorpay instance if valid keys are provided
let razorpay = null;

const getRazorpayInstance = () => {
  if (!razorpay) {
    const keyId = config.razorpay.keyId;
    const keySecret = config.razorpay.keySecret;
    
    // Only initialize if keys are provided and not placeholders
    if (keyId && keySecret && 
        !keyId.includes('xxxxxxxx') && 
        !keySecret.includes('xxxxxxxx') &&
        keyId.startsWith('rzp_')) {
      razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
    } else {
      console.warn('⚠️  Razorpay keys not configured. Payment features will be disabled.');
      console.warn('   To enable payments, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.development');
    }
  }
  return razorpay;
};

// Subscription plans configuration
const PLANS = {
  basic_premium: {
    name: 'Basic Premium',
    amount: 150000,       // ₹1,500 in paise
    duration: 15,          // 15 days
    contactUnlocks: 5,     // 5 contact unlocks
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search'
    ]
  },
  premium_plus: {
    name: 'Premium Plus',
    amount: 300000,       // ₹3,000 in paise
    duration: 30,          // 1 month
    contactUnlocks: 10,    // 10 contact unlocks
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search',
      'profile_boost',
      'spotlight_listing'
    ]
  },
  vip: {
    name: 'VIP',
    amount: 749900,       // ₹7,499 in paise
    duration: 90,          // 3 months
    contactUnlocks: null,  // Unlimited
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search',
      'profile_boost',
      'spotlight_listing',
      'priority_ranking',
      'verified_badge'
    ]
  }
};

// Razorpay caps `receipt` at 40 chars; a bare UUID userId (36) + prefix +
// timestamp blows past that and the order create fails. Keep it short.
const buildReceipt = (userId) => `rcpt_${String(userId).slice(0, 8)}_${Date.now()}`;

// Razorpay SDK rejects with a structured object ({ error: { description } }),
// not an Error, so error.message is undefined. Pull out something useful.
const razorpayErrorText = (e) =>
  e?.error?.description || e?.message || (typeof e === 'string' ? e : JSON.stringify(e));

const createOrder = async (planType, userId) => {
  if (!PLANS[planType]) {
    throw new Error('Invalid plan type');
  }

  const razorpayInstance = getRazorpayInstance();
  if (!razorpayInstance) {
    throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.');
  }

  const plan = PLANS[planType];
  const options = {
    amount: plan.amount,
    currency: 'INR',
    receipt: buildReceipt(userId),
    notes: {
      userId: userId,
      planType: planType
    }
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    };
  } catch (error) {
    throw new Error(`Razorpay order creation failed: ${razorpayErrorText(error)}`);
  }
};

const verifyPayment = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const keySecret = config.razorpay.keySecret;
  if (!keySecret) {
    throw new Error('Razorpay key secret is not configured');
  }
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');

  // Timing-safe compare (mirrors the webhook path). Length guard prevents
  // timingSafeEqual from throwing on a mismatched-length attacker signature.
  if (typeof razorpaySignature !== 'string' || razorpaySignature.length !== expectedSignature.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(razorpaySignature, 'hex')
  );
};

const getPlanDetails = (planType) => {
  return PLANS[planType] || null;
};

/**
 * Create a generic Razorpay order for any amount (used by astrologer bookings etc).
 * @param {number} amountPaise  Amount in paise (INR × 100)
 * @param {string} userId
 * @param {object} notes  Extra metadata stored with the order
 */
const createGenericOrder = async (amountPaise, userId, notes = {}) => {
  const razorpayInstance = getRazorpayInstance();
  if (!razorpayInstance) {
    throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  try {
    const order = await razorpayInstance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: buildReceipt(userId),
      notes: { userId, ...notes },
    });
    return { orderId: order.id, amount: order.amount, currency: order.currency };
  } catch (err) {
    throw new Error(`Razorpay order creation failed: ${razorpayErrorText(err)}`);
  }
};

module.exports = {
  getRazorpayInstance,
  createOrder,
  createGenericOrder,
  verifyPayment,
  getPlanDetails,
  PLANS
};

