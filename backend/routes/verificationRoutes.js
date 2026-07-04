/**
 * Verification Routes
 * Photo (selfie) verification + selfie liveness + background check endpoints.
 * Government-ID document collection removed 2026-07-02 — we only review selfies
 * against the member's own profile photos.
 */

const express = require('express');
const router = express.Router();
const { submitVerification, getVerificationStatus } = require('../controllers/verificationController');
const { auth } = require('../middlewares/auth');
const { uploadDocuments, validateUploadedFiles } = require('../middlewares/upload');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { uploadLimiter, createRateLimiter } = require('../middlewares/security');
const config = require('../config/env');

// BE-5: payment-order creation limiter (mirror subscription routes — 10/hr)
const paymentLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many payment attempts, please try again later',
});
const { submitVerificationValidation } = require('../validators');
const { Verification, User, Profile } = require('../models');
const { createGenericOrder, verifyPayment } = require('../utils/razorpay');
const { submitBgCheck, verifyBgCheckWebhook, parseBgCheckWebhook } = require('../utils/bgCheckService');
const { log } = require('../middlewares/logger');
const { notify } = require('../utils/notifyUser');

// All verification routes require authentication, EXCEPT the provider webhook
router.use((req, res, next) => {
  if (req.path === '/bg-check/webhook') return next();
  auth(req, res, next);
});

// Get verification status (includes bgCheck + selfie fields)
router.get('/status', getVerificationStatus);

// Submit a selfie for photo verification (multipart field: selfiePhoto)
router.post('/submit',
  uploadLimiter,
  uploadDocuments,
  validateUploadedFiles,
  submitVerificationValidation,
  handleValidationErrors,
  submitVerification
);

// ── APP-052: Selfie Liveness Check ───────────────────────────────────────────

// POST /verification/selfie — submit selfie liveness video
router.post('/selfie', uploadLimiter, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const selfieVideoUrl = req.file?.path || req.body.stubVideoUrl || null;

  if (!selfieVideoUrl) {
    throw new AppError('selfieVideo file required', 400);
  }

  let verification = await Verification.findOne({ where: { userId } });
  if (!verification) {
    verification = await Verification.create({ userId, selfieVideoUrl, selfieStatus: 'pending' });
  } else {
    await verification.update({ selfieVideoUrl, selfieStatus: 'pending' });
  }

  if (process.env.NODE_ENV !== 'production') {
    setTimeout(async () => {
      try {
        await verification.update({ selfieStatus: 'passed' });
        await notify(userId, 'system', 'Selfie verified', 'Your selfie liveness check passed.');
      } catch (err) {
        log.warn('Selfie auto-approve failed', { error: err.message });
      }
    }, 3000);
  }

  res.json({
    success: true,
    message: 'Selfie submitted for liveness check',
    selfieStatus: 'pending',
  });
}));

// ── APP-060: Background Check ─────────────────────────────────────────────────

const BG_CHECK_PRICE_PAISE = 49900; // ₹499 in paise

// POST /verification/bg-check/initiate — consent + create Razorpay order
router.post('/bg-check/initiate', paymentLimiter, asyncHandler(async (req, res) => {
  const { consent } = req.body;
  if (consent !== true) throw new AppError('Explicit consent (consent: true) required', 400);

  const userId = req.user.id;
  let verification = await Verification.findOne({ where: { userId } });

  if (verification?.bgCheckStatus === 'passed') {
    throw new AppError('Background check already passed', 400);
  }
  if (verification?.bgCheckStatus === 'in_progress') {
    throw new AppError('Background check already in progress', 400);
  }

  let razorpayOrderId = null;
  try {
    const order = await createGenericOrder(BG_CHECK_PRICE_PAISE, userId, {
      type: 'background_check',
    });
    razorpayOrderId = order.orderId;
  } catch (err) {
    log.warn('Razorpay not configured — bg-check without payment order', { error: err.message });
  }

  if (!verification) {
    verification = await Verification.create({
      userId,
      bgCheckStatus: razorpayOrderId ? 'pending_payment' : 'in_progress',
      bgCheckRequestedAt: new Date(),
      bgCheckRazorpayOrderId: razorpayOrderId,
    });
  } else {
    await verification.update({
      bgCheckStatus: razorpayOrderId ? 'pending_payment' : 'in_progress',
      bgCheckRequestedAt: new Date(),
      bgCheckRazorpayOrderId: razorpayOrderId,
    });
  }

  res.json({
    success: true,
    razorpayOrderId,
    amountPaise: BG_CHECK_PRICE_PAISE,
    message: 'Background check initiated. Complete payment to proceed.',
  });
}));

// POST /verification/bg-check/verify-payment — confirm Razorpay payment + submit to provider
router.post('/bg-check/verify-payment', asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError('razorpay_order_id, razorpay_payment_id, razorpay_signature required', 400);
  }

  const verification = await Verification.findOne({ where: { userId: req.user.id } });
  if (!verification || verification.bgCheckStatus !== 'pending_payment') {
    throw new AppError('No pending background check payment found', 404);
  }

  const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) throw new AppError('Payment verification failed', 400);

  await verification.update({
    bgCheckStatus: 'in_progress',
    bgCheckRazorpayPaymentId: razorpay_payment_id,
  });

  // Submit to real provider (or dev stub) asynchronously — don't block the response
  setImmediate(async () => {
    try {
      const user = await User.findByPk(req.user.id, { attributes: ['email'] });
      const profile = await Profile.findOne({
        where: { userId: req.user.id },
        attributes: ['firstName', 'lastName', 'phone'],
      });

      const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || user?.email || String(req.user.id);
      const phone = profile?.phone || '';

      const { providerRef } = await submitBgCheck({ userId: req.user.id, name, phone });

      await verification.update({ bgCheckProviderRef: providerRef });
      log.info('BGC submitted to provider', { userId: req.user.id, providerRef });

      // Dev stub: auto-complete after 5s
      if (process.env.NODE_ENV !== 'production') {
        setTimeout(async () => {
          try {
            await verification.update({
              bgCheckStatus: 'passed',
              bgCheckCompletedAt: new Date(),
              bgCheckReportRef: providerRef,
            });
            await notify(req.user.id, 'system', 'Background check passed', 'Your background verification is complete.');
          } catch (err) {
            log.warn('BG check dev auto-complete failed', { error: err.message });
          }
        }, 5000);
      }
    } catch (err) {
      log.error('BGC submit to provider failed', { userId: req.user.id, error: err.message });
      // Don't crash — payment is confirmed. Admin can retry manually via providerRef being null.
    }
  });

  res.json({ success: true, status: 'in_progress', message: 'Payment confirmed. Background check in progress.' });
}));

// GET /verification/bg-check/status — poll background check status
router.get('/bg-check/status', asyncHandler(async (req, res) => {
  const verification = await Verification.findOne({
    where: { userId: req.user.id },
    attributes: ['bgCheckStatus', 'bgCheckRequestedAt', 'bgCheckCompletedAt', 'bgCheckReportRef'],
  });

  res.json({
    success: true,
    bgCheckStatus: verification?.bgCheckStatus || 'not_requested',
    bgCheckRequestedAt: verification?.bgCheckRequestedAt,
    bgCheckCompletedAt: verification?.bgCheckCompletedAt,
    hasPassed: verification?.bgCheckStatus === 'passed',
  });
}));

// POST /verification/bg-check/webhook — async result from provider (no auth middleware)
router.post('/bg-check/webhook', asyncHandler(async (req, res) => {
  // WH-4: read only the header matching the configured provider, falling back to
  // the generic x-signature — don't accept any provider's header regardless of config.
  const providerHeader = {
    authbridge: 'x-authbridge-signature',
    signzy: 'x-signzy-signature',
  }[config.bgCheck.provider];
  const signature =
    (providerHeader && req.headers[providerHeader]) ||
    req.headers['x-signature'] ||
    '';

  // WH-2: require the captured raw bytes. Re-serializing req.body can never
  // reproduce the provider's exact signature (key order/whitespace differ), so
  // a JSON.stringify fallback would only ever fail — reject if rawBody is absent.
  const rawBody = req.rawBody;
  if (!rawBody) {
    log.error('[BGC-WEBHOOK] Missing raw body — rawBodyCapture not applied to this path');
    return res.status(500).json({ error: 'Webhook misconfigured' });
  }

  if (!verifyBgCheckWebhook(rawBody, signature)) {
    log.warn('[BGC-WEBHOOK] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let result;
  try {
    result = parseBgCheckWebhook(req.body);
  } catch (err) {
    log.warn('[BGC-WEBHOOK] Parse failed', { error: err.message, body: req.body });
    return res.status(400).json({ error: 'Unparseable payload' });
  }

  const verification = await Verification.findOne({
    where: { bgCheckProviderRef: result.providerRef },
  });

  if (!verification) {
    log.warn('[BGC-WEBHOOK] No verification found for providerRef', { providerRef: result.providerRef });
    return res.status(200).json({ received: true }); // 200 to stop retries
  }

  if (verification.bgCheckStatus === 'passed' || verification.bgCheckStatus === 'failed') {
    return res.status(200).json({ received: true }); // already finalized, idempotent
  }

  await verification.update({
    bgCheckStatus: result.status,
    bgCheckCompletedAt: new Date(),
    bgCheckReportRef: result.providerRef,
  });

  const notifTitle = result.status === 'passed'
    ? 'Background check passed'
    : 'Background check update';
  const notifBody = result.status === 'passed'
    ? 'Your background verification is complete. Your profile now shows the Background Verified badge.'
    : 'Your background check could not be completed. Contact support for details.';

  await notify(verification.userId, 'system', notifTitle, notifBody);

  log.info('[BGC-WEBHOOK] Processed', { userId: verification.userId, status: result.status, providerRef: result.providerRef });

  res.status(200).json({ received: true });
}));

module.exports = router;
