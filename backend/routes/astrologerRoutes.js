/**
 * Astrologer Marketplace Routes (APP-059)
 * Full implementation: DB-backed astrologers, Razorpay payment, Agora video call.
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const { Astrologer, AstrologerBooking } = require('../models');
const { createGenericOrder, verifyPayment } = require('../utils/razorpay');
const { generateRtcToken } = require('../utils/agoraToken');
const config = require('../config/env');
const { log } = require('../middlewares/logger');
const { notify } = require('../utils/notifyUser');

// Seed data inserted on first request if Astrologers table is empty (dev convenience)
const SEED_ASTROLOGERS = [
  {
    name: 'Pt. Rajesh Sharma',
    speciality: ['Kundli Matching', 'Marriage Timing'],
    experience: 18,
    rating: 4.8,
    reviewCount: 342,
    pricePerMin: 25,
    languages: ['Hindi', 'Punjabi', 'English'],
    bio: 'Specializes in Vedic Kundli analysis and Ashtakoot Guna Milan. Certified by Bharatiya Vidya Bhavan.',
    isOnline: true,
  },
  {
    name: 'Acharya Sunita Devi',
    speciality: ['Numerology', 'Career'],
    experience: 12,
    rating: 4.6,
    reviewCount: 198,
    pricePerMin: 18,
    languages: ['Hindi', 'English'],
    bio: 'Expert in numerology and career astrology with 12 years of practice.',
    isOnline: true,
  },
  {
    name: 'Pt. Vikram Joshi',
    speciality: ['Kundli Matching', 'Vastu', 'Gemstone'],
    experience: 25,
    rating: 4.9,
    reviewCount: 571,
    pricePerMin: 35,
    languages: ['Hindi', 'Punjabi'],
    bio: 'Senior Jyotishi with 25 years experience in marriage compatibility and Vastu Shastra.',
    isOnline: false,
  },
];

const ensureSeeded = async () => {
  const count = await Astrologer.count();
  if (count === 0) {
    await Astrologer.bulkCreate(SEED_ASTROLOGERS);
    log.info('Astrologer seed data inserted');
  }
};

// GET /astrologers — list active astrologers (optional ?online=true filter)
router.get('/', auth, asyncHandler(async (req, res) => {
  await ensureSeeded();
  const where = { isActive: true };
  if (req.query.online === 'true') where.isOnline = true;
  const astrologers = await Astrologer.findAll({ where, order: [['rating', 'DESC']] });
  res.json({ success: true, astrologers });
}));

// GET /astrologers/my-bookings — must come before /:id to avoid route shadowing
router.get('/my-bookings', auth, asyncHandler(async (req, res) => {
  const bookings = await AstrologerBooking.findAll({
    where: { userId: req.user.id },
    include: [{ model: Astrologer, as: 'Astrologer', attributes: ['id', 'name', 'avatarUrl'] }],
    order: [['scheduledAt', 'DESC']],
    limit: 50,
  });
  res.json({ success: true, bookings });
}));

// GET /astrologers/:id — single astrologer detail
router.get('/:id', auth, asyncHandler(async (req, res) => {
  await ensureSeeded();
  const ast = await Astrologer.findOne({ where: { id: req.params.id, isActive: true } });
  if (!ast) throw new AppError('Astrologer not found', 404);
  res.json({ success: true, astrologer: ast });
}));

// POST /astrologers/book — create booking + Razorpay order
router.post('/book', auth, asyncHandler(async (req, res) => {
  const { astrologerId, scheduledAt, durationMin } = req.body;

  if (!astrologerId || !scheduledAt || !durationMin) {
    throw new AppError('astrologerId, scheduledAt, durationMin required', 400);
  }
  const dur = Number(durationMin);
  if (!Number.isInteger(dur) || dur < 5 || dur > 120) {
    throw new AppError('durationMin must be an integer between 5 and 120', 400);
  }

  // Only durationMin was validated, so a stale form (or a crafted request) could
  // create a paid booking for a slot in the past — billed, unfulfillable.
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    throw new AppError('scheduledAt must be a valid date', 400);
  }
  if (when.getTime() <= Date.now()) {
    throw new AppError('Please pick a time in the future', 400);
  }
  // Guard the far end too — a booking years out is a data-entry mistake.
  if (when.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000) {
    throw new AppError('Bookings can be made up to 6 months ahead', 400);
  }

  const ast = await Astrologer.findOne({ where: { id: astrologerId, isActive: true } });
  if (!ast) throw new AppError('Astrologer not found', 404);

  const amountPaise = ast.pricePerMin * dur * 100; // INR → paise

  // This catch used to swallow EVERY failure — network blip, Razorpay 5xx, rate
  // limit, rejected amount — and fall through to creating the booking as
  // 'confirmed' with no payment attached, i.e. a free consultation. Only the
  // genuinely-unconfigured case may skip payment, and only outside production.
  let razorpayOrderId = null;
  const paymentsConfigured = config.razorpay.isConfigured();

  if (paymentsConfigured) {
    let order;
    try {
      order = await createGenericOrder(amountPaise, req.user.id, {
        astrologerId,
        durationMin: String(dur),
        type: 'astrologer_booking',
      });
    } catch (err) {
      log.error('Astrologer booking order creation failed', {
        error: err.message,
        userId: req.user.id,
        astrologerId,
        amountPaise,
      });
      throw new AppError('Could not start payment for this booking. Please try again.', 502);
    }
    razorpayOrderId = order.orderId;
  } else if (config.isProduction) {
    // Never hand out unpaid bookings in production.
    throw new AppError('Payments are not available right now. Please try again later.', 503);
  } else {
    log.warn('Razorpay not configured — dev-only booking without payment order', {
      userId: req.user.id,
    });
  }

  const booking = await AstrologerBooking.create({
    userId: req.user.id,
    astrologerId,
    scheduledAt: new Date(scheduledAt),
    durationMin: dur,
    amountPaise,
    status: razorpayOrderId ? 'pending_payment' : 'confirmed',
    razorpayOrderId,
  });

  res.status(201).json({
    success: true,
    booking: {
      id: booking.id,
      astrologerName: ast.name,
      scheduledAt: booking.scheduledAt,
      durationMin: booking.durationMin,
      amountPaise: booking.amountPaise,
      status: booking.status,
      razorpayOrderId: booking.razorpayOrderId,
      keyId: config.razorpay.keyId || null,
    },
  });
}));

// POST /astrologers/book/:bookingId/verify-payment — confirm Razorpay payment
router.post('/book/:bookingId/verify-payment', auth, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError('razorpay_order_id, razorpay_payment_id, razorpay_signature required', 400);
  }

  const booking = await AstrologerBooking.findOne({
    where: { id: req.params.bookingId, userId: req.user.id },
  });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status !== 'pending_payment') throw new AppError('Booking not awaiting payment', 400);

  // The signature only proves that SOME (order, payment) pair is genuine — not
  // that it belongs to THIS booking. Without binding, one real payment (even a
  // cheap one) could be replayed against every other pending booking to confirm
  // them all for free. The subscription path binds by looking the row up via
  // razorpayOrderId; do the equivalent here.
  if (!booking.razorpayOrderId || razorpay_order_id !== booking.razorpayOrderId) {
    log.security('Astrologer payment order mismatch', {
      userId: req.user.id,
      bookingId: booking.id,
      submittedOrderId: razorpay_order_id,
    });
    throw new AppError('Payment does not belong to this booking', 400);
  }

  // A payment id may settle exactly one booking. Belt-and-braces alongside the
  // unique index added in migration 000052.
  const alreadyUsed = await AstrologerBooking.findOne({
    where: { razorpayPaymentId: razorpay_payment_id },
    attributes: ['id'],
  });
  if (alreadyUsed) {
    log.security('Astrologer payment id replay attempt', {
      userId: req.user.id,
      bookingId: booking.id,
      reusedBy: alreadyUsed.id,
    });
    throw new AppError('This payment has already been used', 409);
  }

  const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) throw new AppError('Payment verification failed — invalid signature', 400);

  await booking.update({ status: 'confirmed', razorpayPaymentId: razorpay_payment_id });
  await notify(req.user.id, 'system', 'Booking confirmed', 'Your astrologer consultation has been confirmed.');

  res.json({ success: true, status: 'confirmed', bookingId: booking.id });
}));

// POST /astrologers/book/:bookingId/start-call — get Agora token to start consultation
router.post('/book/:bookingId/start-call', auth, asyncHandler(async (req, res) => {
  const booking = await AstrologerBooking.findOne({
    where: { id: req.params.bookingId, userId: req.user.id },
    include: [{ model: Astrologer, as: 'Astrologer', attributes: ['name'] }],
  });
  if (!booking) throw new AppError('Booking not found', 404);
  if (!['confirmed', 'in_progress'].includes(booking.status)) {
    throw new AppError('Booking must be confirmed before starting call', 400);
  }

  const channel = booking.agoraChannel || `ast_${booking.id}`;
  const tokenResult = generateRtcToken(channel, 0);
  const token = tokenResult ? tokenResult.token : `DEV_STUB_${channel}`;

  if (!booking.agoraChannel) {
    await booking.update({ agoraChannel: channel, status: 'in_progress', callStartedAt: new Date() });
  }

  res.json({
    success: true,
    channel,
    token,
    appId: config.agora.appId || 'DEV_APP_ID',
    durationMin: booking.durationMin,
    astrologerName: booking.Astrologer?.name,
  });
}));

// POST /astrologers/book/:bookingId/end-call — mark consultation completed
router.post('/book/:bookingId/end-call', auth, asyncHandler(async (req, res) => {
  const booking = await AstrologerBooking.findOne({
    where: { id: req.params.bookingId, userId: req.user.id },
  });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status !== 'in_progress') throw new AppError('Call not in progress', 400);

  await booking.update({ status: 'completed', callEndedAt: new Date() });
  res.json({ success: true, status: 'completed' });
}));

module.exports = router;
