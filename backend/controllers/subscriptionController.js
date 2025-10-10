const { validationResult } = require('express-validator');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { User, Payment, ProfileBoost } = require('../models');
const config = require('../config/config');
const { sendSubscriptionExpiryEmail } = require('../utils/emailService');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret
});

// Create subscription order
const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { plan, duration } = req.body;
    const userId = req.user.id;

    // Check if user already has active subscription
    const user = await User.findByPk(userId);
    if (user.isSubscriptionActive() && user.subscriptionType !== 'free') {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription'
      });
    }

    // Get plan details
    const planDetails = config.subscriptionPlans[plan];
    if (!planDetails) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    // Calculate amount (in paise)
    const amount = planDetails.price * 100;
    const orderId = `order_${Date.now()}_${userId}`;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: orderId,
      notes: {
        userId,
        plan,
        duration
      }
    });

    // Save payment record
    await Payment.create({
      userId,
      orderId: order.id,
      amount,
      plan,
      planDuration: duration,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: config.razorpay.keyId
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order'
    });
  }
};

// Verify payment and activate subscription
const verifyPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { orderId, paymentId, signature } = req.body;
    const userId = req.user.id;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Get payment record
    const payment = await Payment.findOne({
      where: { orderId, userId, status: 'pending' }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Update payment record
    await payment.update({
      paymentId,
      status: 'completed',
      razorpaySignature: signature
    });

    // Activate subscription
    const user = await User.findByPk(userId);
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + payment.planDuration);

    await user.update({
      subscriptionType: payment.plan,
      subscriptionExpiry
    });

    res.json({
      success: true,
      message: 'Payment verified and subscription activated successfully',
      data: {
        subscriptionType: payment.plan,
        subscriptionExpiry,
        payment: payment.toJSON()
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying payment'
    });
  }
};

// Get subscription status
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    const isActive = user.isSubscriptionActive();
    const daysLeft = user.subscriptionExpiry 
      ? Math.ceil((user.subscriptionExpiry - new Date()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      success: true,
      data: {
        subscriptionType: user.subscriptionType,
        subscriptionExpiry: user.subscriptionExpiry,
        isActive,
        daysLeft: Math.max(0, daysLeft),
        planDetails: config.subscriptionPlans[user.subscriptionType]
      }
    });

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription status'
    });
  }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const payments = await Payment.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        payments: payments.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(payments.count / limit),
          totalCount: payments.count,
          hasNext: offset + limit < payments.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment history'
    });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (user.subscriptionType === 'free') {
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    // Set subscription expiry to current date (immediate cancellation)
    await user.update({
      subscriptionExpiry: new Date()
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling subscription'
    });
  }
};

// Create profile boost order
const createBoostOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { duration } = req.body;
    const userId = req.user.id;

    // Check if user already has active boost
    const user = await User.findByPk(userId);
    if (user.isBoostActive()) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active profile boost'
      });
    }

    // Calculate amount based on duration (₹50 per hour)
    const amount = duration * 50 * 100; // Convert to paise
    const orderId = `boost_${Date.now()}_${userId}`;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: orderId,
      notes: {
        userId,
        type: 'boost',
        duration
      }
    });

    // Save payment record
    await Payment.create({
      userId,
      orderId: order.id,
      amount,
      plan: 'boost',
      planDuration: duration,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: config.razorpay.keyId,
        duration
      }
    });

  } catch (error) {
    console.error('Create boost order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating boost order'
    });
  }
};

// Verify boost payment
const verifyBoostPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { orderId, paymentId, signature } = req.body;
    const userId = req.user.id;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Get payment record
    const payment = await Payment.findOne({
      where: { orderId, userId, status: 'pending', plan: 'boost' }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Boost payment record not found'
      });
    }

    // Update payment record
    await payment.update({
      paymentId,
      status: 'completed',
      razorpaySignature: signature
    });

    // Activate profile boost
    const boostStartTime = new Date();
    const boostEndTime = new Date();
    boostEndTime.setHours(boostEndTime.getHours() + payment.planDuration);

    await ProfileBoost.create({
      userId,
      boostStartTime,
      boostEndTime,
      duration: payment.planDuration,
      isPaid: true,
      paymentId: payment.id
    });

    // Update user's boost expiry
    const user = await User.findByPk(userId);
    await user.update({
      boostExpiry: boostEndTime
    });

    res.json({
      success: true,
      message: 'Profile boost activated successfully',
      data: {
        boostStartTime,
        boostEndTime,
        duration: payment.planDuration,
        payment: payment.toJSON()
      }
    });

  } catch (error) {
    console.error('Verify boost payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying boost payment'
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getSubscriptionStatus,
  getPaymentHistory,
  cancelSubscription,
  createBoostOrder,
  verifyBoostPayment
};
