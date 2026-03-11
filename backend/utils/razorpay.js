const Razorpay = require('razorpay');
const crypto = require('crypto');

// Lazy initialization - only create Razorpay instance if valid keys are provided
let razorpay = null;

const getRazorpayInstance = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
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
    amount: 199900,       // ₹1,999 in paise
    duration: 90,          // 3 months
    contactUnlocks: 30,    // Limited unlocks
    features: [
      'view_contacts',
      'unlimited_messages',
      'who_viewed_profile',
      'advanced_search'
    ]
  },
  premium_plus: {
    name: 'Premium Plus',
    amount: 399900,       // ₹3,999 in paise
    duration: 180,         // 6 months
    contactUnlocks: null,  // Unlimited
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
    amount: 999900,       // ₹9,999 in paise
    duration: 365,         // 12 months
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
    receipt: `order_${userId}_${Date.now()}`,
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
    throw new Error(`Razorpay order creation failed: ${error.message}`);
  }
};

const verifyPayment = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === razorpaySignature;
};

const getPlanDetails = (planType) => {
  return PLANS[planType] || null;
};

module.exports = {
  getRazorpayInstance,
  createOrder,
  verifyPayment,
  getPlanDetails,
  PLANS
};

