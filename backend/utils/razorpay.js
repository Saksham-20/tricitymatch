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

// Subscription plans configuration — single source of truth for price/tenure/
// unlocks AND presentation (mrp/badge/durationLabel/features). getPlans() in
// subscriptionController maps over this; do not re-hardcode prices there.
// `amount`/`mrp` are in paise. `duration` is days. `contactUnlocks: null` =
// unlimited. Enum keys are fixed (persisted); prices are remapped here.
const PLANS = {
  basic_premium: {
    name: 'Basic',
    amount: 129900,        // ₹1,299
    mrp: 199900,           // ₹1,999 (strike-through anchor)
    duration: 30,          // 30 days
    durationLabel: '30 days',
    contactUnlocks: 5,
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search'
    ]
  },
  premium_plus: {
    name: 'Premium',
    amount: 249900,        // ₹2,499
    mrp: 399900,           // ₹3,999
    duration: 90,          // 90 days
    durationLabel: '90 days',
    contactUnlocks: 15,
    popular: true,
    badge: 'Most Popular',
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search',
      'profile_boost',
      'spotlight_listing'
    ]
  },
  elite: {
    name: 'Elite',
    amount: 399900,        // ₹3,999
    mrp: 699900,           // ₹6,999
    duration: 180,         // 180 days
    durationLabel: '6 months',
    contactUnlocks: 30,
    badge: 'Best Value',
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search',
      'profile_boost',
      'spotlight_listing',
      'priority_ranking'
    ]
  },
  vip: {
    name: 'VIP',
    amount: 599900,        // ₹5,999
    mrp: 1199900,          // ₹11,999
    duration: 360,         // 360 days (12 months)
    durationLabel: '12 months',
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
  },
  nri: {
    name: 'NRI Connect',
    amount: 999900,        // ₹9,999
    mrp: 1799900,          // ₹17,999 (strike-through anchor)
    duration: 180,         // 180 days
    durationLabel: '6 months',
    contactUnlocks: null,  // Unlimited
    badge: 'NRI',
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search',
      'profile_boost',
      'spotlight_listing',
      'priority_ranking',
      'verified_badge',
      'nri_priority_support',
      'timezone_aware_matching'
    ]
  }
};

// À-la-carte contact-unlock top-ups (not a plan). Priced ABOVE every finite
// plan's per-unlock rate so upgrading always beats stacking bundles. Ride the
// active subscription row (increment contactUnlocksAllowed). Not for unlimited
// plans (vip/nri). `amount` in paise.
const UNLOCK_BUNDLES = {
  bundle_3:  { name: '3 Contact Unlocks',  unlocks: 3,  amount: 59900 },   // ₹599
  bundle_10: { name: '10 Contact Unlocks', unlocks: 10, amount: 149900 },  // ₹1,499
  bundle_25: { name: '25 Contact Unlocks', unlocks: 25, amount: 349900 },  // ₹3,499
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

/**
 * Create a Razorpay order for an à-la-carte unlock bundle.
 * @param {string} bundleId  key of UNLOCK_BUNDLES
 * @param {string} userId
 */
const createBundleOrder = async (bundleId, userId) => {
  const bundle = UNLOCK_BUNDLES[bundleId];
  if (!bundle) {
    throw new Error('Invalid bundle id');
  }
  const order = await createGenericOrder(bundle.amount, userId, {
    type: 'unlock_bundle',
    bundleId,
    unlocks: bundle.unlocks,
  });
  return { ...order, bundleId, unlocks: bundle.unlocks };
};

const getBundleDetails = (bundleId) => UNLOCK_BUNDLES[bundleId] || null;

module.exports = {
  getRazorpayInstance,
  createOrder,
  createGenericOrder,
  createBundleOrder,
  verifyPayment,
  getPlanDetails,
  getBundleDetails,
  PLANS,
  UNLOCK_BUNDLES
};

