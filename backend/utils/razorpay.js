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
  premium: {
    name: 'Premium',
    amount: 2999, // in paise (₹29.99)
    duration: 30, // days
    features: ['unlimited_likes', 'view_contacts', 'chat', 'who_liked_you']
  },
  elite: {
    name: 'Elite',
    amount: 4999, // in paise (₹49.99)
    duration: 30, // days
    features: ['unlimited_likes', 'view_contacts', 'chat', 'who_liked_you', 'priority_support', 'verified_badge']
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

