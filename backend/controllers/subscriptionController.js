const { Subscription, User } = require('../models');
const { createOrder, verifyPayment, getPlanDetails } = require('../utils/razorpay');
const { sendSubscriptionReminder } = require('../utils/emailService');

// @route   POST /api/subscription/create-order
// @desc    Create Razorpay order
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const { planType } = req.body;
    const userId = req.user.id;

    if (!['premium', 'elite'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }

    // Check if user already has active subscription
    const activeSubscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active'
      }
    });

    if (activeSubscription) {
      return res.status(400).json({
        message: 'You already have an active subscription',
        subscription: activeSubscription
      });
    }

    const order = await createOrder(planType, userId);

    // Create subscription record
    const subscription = await Subscription.create({
      userId,
      planType,
      razorpayOrderId: order.orderId,
      status: 'pending',
      amount: order.amount / 100 // Convert from paise to rupees
    });

    res.json({
      success: true,
      order: {
        id: order.orderId,
        amount: order.amount,
        currency: order.currency
      },
      subscription
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/subscription/verify-payment
// @desc    Verify Razorpay payment
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user.id;

    // Verify payment signature
    const isValid = verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Find subscription
    const subscription = await Subscription.findOne({
      where: {
        userId,
        razorpayOrderId,
        status: 'pending'
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Get plan details
    const planDetails = getPlanDetails(subscription.planType);
    if (!planDetails) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }

    // Update subscription
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + planDetails.duration);

    subscription.razorpayPaymentId = razorpayPaymentId;
    subscription.razorpaySignature = razorpaySignature;
    subscription.status = 'active';
    subscription.startDate = now;
    subscription.endDate = endDate;
    await subscription.save();

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/subscription/my-subscription
// @desc    Get current user's subscription
// @access  Private
exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await Subscription.findOne({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
      return res.json({
        success: true,
        subscription: {
          planType: 'free',
          status: 'active'
        }
      });
    }

    // Check if subscription expired
    if (subscription.status === 'active' && subscription.endDate) {
      const now = new Date();
      if (now > subscription.endDate) {
        subscription.status = 'expired';
        await subscription.save();
      }
    }

    res.json({
      success: true,
      subscription
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/subscription/plans
// @desc    Get available subscription plans
// @access  Public
exports.getPlans = async (req, res) => {
  try {
    const plans = {
      free: {
        name: 'Free',
        price: 0,
        duration: 'Unlimited',
        features: ['basic_search', 'limited_likes', 'profile_viewing']
      },
      premium: {
        name: 'Premium',
        price: 2999,
        duration: '30 days',
        features: ['unlimited_likes', 'view_contacts', 'chat', 'who_liked_you', 'advanced_search']
      },
      elite: {
        name: 'Elite',
        price: 4999,
        duration: '30 days',
        features: [
          'unlimited_likes',
          'view_contacts',
          'chat',
          'who_liked_you',
          'advanced_search',
          'priority_support',
          'verified_badge',
          'profile_boost'
        ]
      }
    };

    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/subscription/webhook
// @desc    Razorpay webhook handler
// @access  Public (should be secured with webhook secret in production)
exports.webhook = async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (event === 'payment.captured') {
      const { order_id, payment_id } = payload.payment.entity;

      const subscription = await Subscription.findOne({
        where: { razorpayOrderId: order_id }
      });

      if (subscription && subscription.status === 'pending') {
        const planDetails = getPlanDetails(subscription.planType);
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + planDetails.duration);

        subscription.razorpayPaymentId = payment_id;
        subscription.status = 'active';
        subscription.startDate = now;
        subscription.endDate = endDate;
        await subscription.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook error', error: error.message });
  }
};

