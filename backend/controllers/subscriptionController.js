/**
 * Subscription Controller
 * Handles payment processing with Razorpay
 */

const { Subscription, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { createOrder: razorpayCreateOrder, verifyPayment, getPlanDetails } = require('../utils/razorpay');
const { sendSubscriptionConfirmation } = require('../utils/email');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');

// @route   POST /api/subscription/create-order
// @desc    Create Razorpay order
// @access  Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { planType } = req.body;
  const userId = req.user.id;

  // Check if Razorpay is configured
  if (!config.razorpay.isConfigured()) {
    throw createError.internal('Payment gateway is not configured');
  }

  // Validate plan type
  const validPlans = ['premium', 'elite'];
  if (!validPlans.includes(planType)) {
    throw createError.badRequest('Invalid plan type');
  }

  // Use transaction for atomicity
  const result = await sequelize.transaction(async (t) => {
    // Check for existing active subscription
    const activeSubscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        endDate: { [Op.gt]: new Date() }
      },
      transaction: t
    });

    if (activeSubscription) {
      throw createError.conflict('You already have an active subscription');
    }

    // Cancel any existing pending orders for this user
    await Subscription.update(
      { status: 'cancelled' },
      {
        where: {
          userId,
          status: 'pending'
        },
        transaction: t
      }
    );

    // Create Razorpay order
    const order = await razorpayCreateOrder(planType, userId);

    // Create subscription record
    const subscription = await Subscription.create({
      userId,
      planType,
      razorpayOrderId: order.orderId,
      status: 'pending',
      amount: order.amount / 100 // Convert from paise to rupees
    }, { transaction: t });

    return { order, subscription };
  });

  logAudit('subscription_order_created', req.user.id, {
    planType,
    orderId: result.order.orderId,
    amount: result.order.amount
  });

  res.json({
    success: true,
    order: {
      id: result.order.orderId,
      amount: result.order.amount,
      currency: result.order.currency
    },
    subscription: result.subscription
  });
});

// @route   POST /api/subscription/verify-payment
// @desc    Verify Razorpay payment and activate subscription
// @access  Private
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const userId = req.user.id;

  // Validate required fields
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw createError.badRequest('Missing payment details');
  }

  // Verify payment signature
  const isValid = verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (!isValid) {
    log.warn('Payment signature verification failed', { userId, razorpayOrderId });
    throw createError.badRequest('Payment verification failed');
  }

  // Activate subscription with transaction
  const subscription = await sequelize.transaction(async (t) => {
    // Check idempotency - if payment already processed
    const existingPayment = await Subscription.findOne({
      where: {
        razorpayPaymentId,
        status: 'active'
      },
      transaction: t
    });

    if (existingPayment) {
      // Payment already processed - return existing subscription
      log.info('Payment already processed (idempotent)', { 
        userId, 
        paymentId: razorpayPaymentId,
        subscriptionId: existingPayment.id
      });
      return existingPayment;
    }

    // Find and lock the subscription
    const sub = await Subscription.findOne({
      where: {
        userId,
        razorpayOrderId,
        status: 'pending'
      },
      transaction: t,
      lock: true // Lock for update to prevent race conditions
    });

    if (!sub) {
      throw createError.notFound('Subscription not found or already processed');
    }

    // Get plan details
    const planDetails = getPlanDetails(sub.planType);
    if (!planDetails) {
      throw createError.badRequest('Invalid plan type');
    }

    // Calculate subscription dates
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + planDetails.duration);

    // Update subscription
    sub.razorpayPaymentId = razorpayPaymentId;
    sub.razorpaySignature = razorpaySignature;
    sub.status = 'active';
    sub.startDate = now;
    sub.endDate = endDate;
    await sub.save({ transaction: t });

    // Cancel any other pending subscriptions for this user
    await Subscription.update(
      { status: 'cancelled' },
      {
        where: {
          userId,
          status: 'pending',
          id: { [Op.ne]: sub.id }
        },
        transaction: t
      }
    );

    return sub;
  });

  // Log audit event
  logAudit('subscription_activated', userId, {
    subscriptionId: subscription.id,
    planType: subscription.planType,
    paymentId: razorpayPaymentId,
    endDate: subscription.endDate
  });

  // Send confirmation email asynchronously
  const user = await User.findByPk(userId, { attributes: ['email', 'firstName'] });
  if (user?.email) {
    setImmediate(() => {
      sendSubscriptionConfirmation(
        user.email,
        user.firstName || 'User',
        subscription.planType,
        subscription.endDate.toLocaleDateString()
      ).catch(err => log.error('Failed to send subscription email', { error: err.message }));
    });
  }

  res.json({
    success: true,
    message: 'Payment verified and subscription activated',
    subscription
  });
});

// @route   GET /api/subscription/my-subscription
// @desc    Get current user's subscription
// @access  Private
exports.getMySubscription = asyncHandler(async (req, res) => {
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

  // Check if subscription expired and update status
  if (subscription.status === 'active' && subscription.endDate) {
    const now = new Date();
    if (now > new Date(subscription.endDate)) {
      subscription.status = 'expired';
      await subscription.save();
    }
  }

  res.json({
    success: true,
    subscription
  });
});

// @route   GET /api/subscription/plans
// @desc    Get available subscription plans
// @access  Public
exports.getPlans = asyncHandler(async (req, res) => {
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
      features: [
        'unlimited_likes',
        'view_contacts',
        'chat',
        'who_liked_you',
        'advanced_search'
      ]
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
});

// @route   POST /api/subscription/webhook
// @desc    Razorpay webhook handler
// @access  Public (verified by signature)
exports.webhook = asyncHandler(async (req, res) => {
  const { event, payload } = req.body;

  log.info('Webhook received', { event });

  if (event === 'payment.captured') {
    const { order_id, id: payment_id } = payload.payment.entity;

    await sequelize.transaction(async (t) => {
      // Check idempotency first
      const existingActive = await Subscription.findOne({
        where: { 
          razorpayOrderId: order_id,
          status: 'active'
        },
        transaction: t
      });

      if (existingActive) {
        log.info('Webhook: Payment already processed', { orderId: order_id });
        return;
      }

      const subscription = await Subscription.findOne({
        where: { razorpayOrderId: order_id },
        transaction: t,
        lock: true
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
        await subscription.save({ transaction: t });

        logAudit('subscription_activated_webhook', subscription.userId, {
          subscriptionId: subscription.id,
          orderId: order_id,
          paymentId: payment_id
        });

        log.info('Subscription activated via webhook', { 
          subscriptionId: subscription.id,
          userId: subscription.userId
        });
      }
    });
  } else if (event === 'payment.failed') {
    const { order_id, error_description } = payload.payment.entity;

    const subscription = await Subscription.findOne({
      where: { razorpayOrderId: order_id }
    });

    if (subscription && subscription.status === 'pending') {
      subscription.status = 'cancelled';
      await subscription.save();
      
      log.warn('Payment failed', { 
        subscriptionId: subscription.id,
        orderId: order_id,
        reason: error_description
      });
    }
  }

  // Always return 200 to acknowledge webhook
  res.json({ success: true });
});
