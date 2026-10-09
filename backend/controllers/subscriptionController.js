/**
 * Subscription Controller
 * Handles payment processing with Razorpay
 */

const { Subscription, User, Profile, UnlockPurchase } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  PAID_PLANS,
  PURCHASABLE_PLANS,
  UNLIMITED_PLANS,
  TIER_RANK,
  FOUNDING_CONTACT_UNLOCKS,
  FOUNDING_PLAN,
  GOOGLE_PLAY_PRODUCTS,
} = require('../constants/plans');
const { grantFoundingIfOpen } = require('../utils/foundingGrant');
const { applyPendingCredits } = require('../utils/inviteReward');
const {
  createOrder: razorpayCreateOrder,
  verifyPayment: razorpayVerifyPayment,
  getPlanDetails,
  isPlanPurchasable,
  createBundleOrder: razorpayCreateBundleOrder,
  getBundleDetails,
  PLANS,
  UNLOCK_BUNDLES,
} = require('../utils/razorpay');
const { sendSubscriptionConfirmation, memberDate } = require('../utils/email');
const { planEndDate, termEndDate } = require('../utils/planTerm');
const config = require('../config/env');
const { createError, asyncHandler, AppError } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { generateInvoicePDF } = require('../utils/invoice');
const { getOfferState, getFoundingState } = require('../utils/launchOffer');
const { notify } = require('../utils/notifyUser');
const { recordRefund, recordDispute } = require('../utils/paymentRefunds');
const { activateCapturedPayment, markLeadPaid, termsForActivation } = require('../utils/subscriptionActivation');
const { invoiceBlocker } = require('../utils/invoiceEligibility');
const {
  ReferralError,
  quoteReferral,
  settleReferral,
  getReferralSummary,
} = require('../utils/referral');

// @route   POST /api/subscription/create-order
// @desc    Create Razorpay order
// @access  Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { planType, referralCode } = req.body;
  const userId = req.user.id;

  // Check if Razorpay is configured
  if (!config.razorpay.isConfigured()) {
    throw createError.internal('Payment gateway is not configured');
  }

  // Validate plan type against the PURCHASABLE list (createOrderValidation
  // already rejects the rest; this is the defence-in-depth copy). Using
  // PAID_PLANS here would let `founding_premium` — a granted, priceless tier —
  // through to Razorpay, which has no order for it.
  if (!PURCHASABLE_PLANS.includes(planType)) {
    throw createError.badRequest('Invalid plan type');
  }

  // …and against the live offer, which can WITHDRAW a tier. PURCHASABLE_PLANS
  // is the static enum allowlist; a withdrawn tier is still in it. Checking
  // here as well as in razorpay.createOrder means the request fails with a
  // clean 400 before a transaction is opened.
  if (!isPlanPurchasable(planType)) {
    throw createError.badRequest('That plan is not available right now');
  }

  // A referral code is validated BEFORE the transaction and BEFORE the gateway
  // call: a bad code is the member's to fix, and must not cost them an order.
  // The discount is computed from the same effective plan `razorpayCreateOrder`
  // charges, then handed to it, so the quote and the charge cannot disagree.
  let quote = null;
  if (typeof referralCode === 'string' && referralCode.trim()) {
    try {
      quote = await quoteReferral(referralCode, getPlanDetails(planType), userId);
    } catch (err) {
      if (err instanceof ReferralError) throw createError.badRequest(err.message, { code: err.code });
      throw err;
    }
  }

  // Tier rank — a paid member can only move UP a tier while their plan is active.
  // Same-tier renewal or a downgrade while active is rejected (handle via support).

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
      const currentRank = TIER_RANK[activeSubscription.planType] || 0;
      const targetRank = TIER_RANK[planType] || 0;
      if (targetRank <= currentRank) {
        // Same plan or lower — not an upgrade.
        throw createError.conflict(
          targetRank === currentRank
            ? 'You are already on this plan.'
            : 'You are on a higher plan. Contact support to change your plan.'
        );
      }
      // Otherwise it's a genuine upgrade — allow a new order. The old active
      // subscription is superseded when the upgrade payment is verified.
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
    const order = await razorpayCreateOrder(planType, userId, {
      discountPaise: quote?.discountPaise || 0,
      referralCode: quote?.referral.code,
    });

    // Create subscription record. `orderTerms` freezes what the buyer agreed
    // to: the amount is fixed by the gateway order, so duration and unlocks
    // must not drift with a later offer edit before the payment lands.
    const soldPlan = getPlanDetails(planType);
    const subscription = await Subscription.create({
      userId,
      planType,
      razorpayOrderId: order.orderId,
      status: 'pending',
      amount: order.amount / 100, // Convert from paise to rupees
      referral: quote ? quote.referral : null,
      orderTerms: { duration: soldPlan.duration, contactUnlocks: soldPlan.contactUnlocks, endsOn: soldPlan.endsOn || null },
    }, { transaction: t });

    return { order, subscription };
  });

  logAudit('subscription_order_created', req.user.id, {
    planType,
    orderId: result.order.orderId,
    amount: result.order.amount,
    ...(quote ? { referralCode: quote.referral.code, discountPaise: quote.discountPaise } : {}),
  });

  res.json({
    success: true,
    order: {
      id: result.order.orderId,
      amount: result.order.amount,
      currency: result.order.currency
    },
    discount: quote ? { code: quote.referral.code, amount: quote.discountPaise / 100 } : null,
    subscription: result.subscription
  });
});

// @route   GET /api/subscription/referral
// @desc    The caller's referral panel: their code + share link, what it pays,
//          how it is doing, and a code to pre-fill at checkout
// @access  Private
exports.getReferral = asyncHandler(async (req, res) => {
  res.json({ success: true, referral: await getReferralSummary(req.user.id) });
});

// @route   POST /api/subscription/referral/check
// @desc    Preview a referral code against a plan WITHOUT creating an order
// @access  Private
// The same `quoteReferral` createOrder runs, so the preview cannot promise a
// discount the order then refuses (or the reverse).
exports.checkReferral = asyncHandler(async (req, res) => {
  const { code, planType } = req.body;
  if (!PURCHASABLE_PLANS.includes(planType) || !isPlanPurchasable(planType)) {
    throw createError.badRequest('That plan is not available right now');
  }
  try {
    const quote = await quoteReferral(code, getPlanDetails(planType), req.user.id);
    res.json({
      success: true,
      valid: true,
      code: quote.referral.code,
      kind: quote.referral.kind,
      referrerName: quote.referrerName,
      discount: quote.discountPaise / 100,
      price: getPlanDetails(planType).amount / 100,
      finalPrice: quote.finalPaise / 100,
    });
  } catch (err) {
    if (err instanceof ReferralError) {
      return res.status(200).json({ success: true, valid: false, reason: err.code, message: err.message });
    }
    throw err;
  }
});

// @route   POST /api/subscription/cancel-order
// @desc    The member closed the payment popup without paying. Closes the order
//          completely — it does not linger as `pending`.
// @access  Private
//
// `pending` is reserved for a payment that may still resolve (money possibly
// moved, or an attempt failed and can be retried). A member simply changing
// their mind is neither, so the order is closed here rather than left for a
// job to chase. If an attempt HAS failed the row stays pending — that is a
// payment problem, and it is what earns the one help mail.
//
// Idempotent and never an error for the caller: the client fires this from a
// dismiss handler and has nothing useful to do with a failure.
exports.cancelOrder = asyncHandler(async (req, res) => {
  const { razorpayOrderId } = req.body;

  const order = await Subscription.findOne({
    where: { userId: req.user.id, razorpayOrderId, status: 'pending', razorpayPaymentId: null },
  });
  if (!order) {
    return res.json({ success: true, cancelled: false });
  }

  const ledger = order.lifecycleMail || {};
  if (ledger.paymentFailedAt) {
    return res.json({ success: true, cancelled: false, reason: 'payment_issue' });
  }

  // Conditional update, not `save()`: if the payment landed between the read
  // and now the row is no longer pending, and writing 'cancelled' over a
  // freshly activated plan would take away something the member just paid for.
  const [changed] = await Subscription.update(
    { status: 'cancelled', lifecycleMail: { ...ledger, cancelledAt: new Date().toISOString() } },
    { where: { id: order.id, status: 'pending', razorpayPaymentId: null } }
  );

  if (changed) {
    logAudit('subscription_order_cancelled', req.user.id, {
      subscriptionId: order.id,
      planType: order.planType,
      orderId: razorpayOrderId,
    });
  }
  res.json({ success: true, cancelled: changed > 0 });
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
  const isValid = razorpayVerifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

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
        userId,
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

    // Find and lock the subscription. `cancelled` with no payment attached is
    // accepted too: the member closing the popup (or the stale-order sweeper)
    // closes an order that can still be paid — Razorpay keeps it payable — and
    // a signature-verified payment on it means money moved, so the entitlement
    // has to follow. A cancelled row that DOES carry a payment id is a real
    // cancelled plan and is never revived.
    const sub = await Subscription.findOne({
      where: {
        userId,
        razorpayOrderId,
        status: { [Op.in]: ['pending', 'cancelled'] },
        razorpayPaymentId: null
      },
      transaction: t,
      lock: true // Lock for update to prevent race conditions
    });

    if (!sub) {
      // The captured-payment webhook (or reconciler) can commit between the
      // idempotency pre-check above and this lock. The plan is then already
      // active for THIS payment, so answer with it instead of telling a member
      // who has paid that verification failed.
      const racedActivation = await Subscription.findOne({
        where: { userId, razorpayOrderId, razorpayPaymentId, status: 'active' },
        transaction: t,
      });
      if (racedActivation) {
        log.info('Payment already activated by the webhook (idempotent)', {
          userId, paymentId: razorpayPaymentId, subscriptionId: racedActivation.id,
        });
        return racedActivation;
      }
      throw createError.notFound('Subscription not found or already processed');
    }

    // Terms agreed at create-order win over the live plan (PAY-07).
    const planDetails = termsForActivation(sub);
    if (!planDetails) {
      throw createError.badRequest('Invalid plan type');
    }

    // Calculate subscription dates
    const now = new Date();
    const endDate = termEndDate(now, planDetails);

    // Update subscription
    sub.razorpayPaymentId = razorpayPaymentId;
    sub.razorpaySignature = razorpaySignature;
    sub.status = 'active';
    sub.startDate = now;
    sub.endDate = endDate;
    // Set contact unlock limits based on plan
    sub.contactUnlocksAllowed = planDetails.contactUnlocks;
    sub.contactUnlocksUsed = 0;
    await sub.save({ transaction: t });

    // Invite credits earned while the member had no subscription to hold them
    // move onto this row now. Inside the transaction on purpose: if the
    // activation rolls back, the balance must not have been spent.
    await applyPendingCredits(userId, sub, t);

    // Supersede any OTHER subscription that's still pending OR active (the plan
    // being upgraded FROM) so exactly one active subscription remains per user.
    await Subscription.update(
      { status: 'cancelled' },
      {
        where: {
          userId,
          status: { [Op.in]: ['pending', 'active'] },
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

  // Release the referral reward / marketing attribution for a code used at
  // checkout. Never throws; the webhook leg calls the same function, and a
  // conditional claim inside makes whichever runs second a no-op.
  if (subscription.referral) await settleReferral(subscription.id);

  // Mark the referring rep's lead as paid — the same helper the webhook and
  // reconciler legs call, so which leg activated the plan cannot decide it.
  await markLeadPaid(subscription);

  // Unlimited plans (VIP / NRI): activate profile boost for the plan term
  if (UNLIMITED_PLANS.includes(subscription.planType)) {
    const boostExpiry = new Date(subscription.endDate);
    await User.update(
      { isBoosted: true, boostExpiresAt: boostExpiry },
      { where: { id: userId } }
    );
  }

  // Send confirmation email asynchronously. firstName lives on Profile, not
  // User — selecting it off User threw "column firstName does not exist",
  // which surfaced to the buyer as "Payment verification failed" even though
  // the subscription had already been activated above.
  // Never let confirmation-email work fail an already-activated payment.
  try {
    const user = await User.findByPk(userId, {
      attributes: ['email'],
      include: [{ model: Profile, attributes: ['firstName'] }],
    });
    if (user?.email) {
      setImmediate(() => {
        sendSubscriptionConfirmation(
          user.email,
          user.Profile?.firstName || 'User',
          subscription.planType,
          subscription.endDate
        ).catch(err => log.error('Failed to send subscription email', { error: err.message }));
      });
    }
  } catch (err) {
    log.error('Subscription confirmation email setup failed (payment already activated)', { error: err.message });
  }

  res.json({
    success: true,
    message: 'Payment verified and subscription activated',
    subscription
  });
});

// @route   POST /api/subscription/google-verify
// @desc    Verify a Google Play subscription purchase and activate the plan
// @access  Private
// Android "user-choice billing" second rail: when a member pays via Google Play
// (instead of Razorpay), the client sends the productId + purchaseToken here. We
// validate the token against the Google Play Developer API, then activate the
// plan through the same supersede-and-reset logic as the Razorpay path.
exports.verifyGooglePlay = asyncHandler(async (req, res) => {
  if (!config.googlePlay.isConfigured()) {
    throw new AppError('Google Play billing is not configured', 503);
  }

  const { productId, purchaseToken } = req.body;
  const userId = req.user.id;

  if (!productId || !purchaseToken) {
    throw createError.badRequest('Missing productId or purchaseToken');
  }

  const planType = GOOGLE_PLAY_PRODUCTS[productId];
  if (!planType || !PAID_PLANS.includes(planType)) {
    throw createError.badRequest('Unknown Google Play product');
  }

  // --- Validate the purchase token against Google Play Developer API ---
  const { JWT } = require('google-auth-library');
  let creds;
  try {
    creds = JSON.parse(config.googlePlay.serviceAccountJson);
  } catch {
    throw createError.internal('Google Play service account is misconfigured');
  }
  const jwtClient = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const pkg = config.googlePlay.packageName;
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  let purchase;
  try {
    const resp = await jwtClient.request({ url: base });
    purchase = resp.data;
  } catch (err) {
    log.warn('Google Play token verification failed', { userId, productId, error: err.message });
    throw createError.badRequest('Could not verify Google Play purchase');
  }

  // paymentState: 0 pending, 1 received, 2 free trial, 3 deferred. Require paid.
  const paid = purchase && (purchase.paymentState === 1 || purchase.paymentState === 2);
  const notExpired = purchase && Number(purchase.expiryTimeMillis || 0) > Date.now();
  if (!paid || !notExpired) {
    throw createError.badRequest('Google Play purchase is not active');
  }

  // If the client stamped the purchase with an account binding, enforce it.
  // Checked conditionally: the field is only present when the buyer flow set
  // it, so requiring it outright would reject otherwise-valid purchases.
  const boundAccount = purchase.obfuscatedExternalAccountId;
  if (boundAccount && boundAccount !== userId) {
    log.security('Google Play purchase bound to a different account', {
      userId,
      boundAccount,
      productId,
    });
    throw createError.badRequest('This purchase belongs to a different account');
  }

  // Acknowledge within Google's 3-day window (else auto-refund).
  if (purchase.acknowledgementState === 0) {
    try {
      await jwtClient.request({ url: `${base}:acknowledge`, method: 'POST', data: {} });
    } catch (err) {
      log.warn('Google Play acknowledge failed (continuing)', { userId, error: err.message });
    }
  }

  const planDetails = getPlanDetails(planType);
  if (!planDetails) {
    throw createError.badRequest('Invalid plan type');
  }

  const subscription = await sequelize.transaction(async (t) => {
    // Idempotency is keyed on the purchase token ALONE, deliberately not on
    // (userId, token). Scoping it to the user meant one real purchase token —
    // shared, resold or leaked — activated the tier on an unbounded number of
    // accounts, since each new account simply found no row of its own.
    const existing = await Subscription.findOne({
      where: { razorpayPaymentId: purchaseToken },
      transaction: t,
    });
    if (existing) {
      if (existing.userId !== userId) {
        log.security('Google Play purchase token replay across accounts', {
          userId,
          ownerUserId: existing.userId,
          productId,
        });
        throw createError.conflict('This purchase is already linked to another account');
      }
      if (existing.status === 'active') return existing;
      throw createError.conflict('This purchase has already been used');
    }

    const now = new Date();
    // Clamp the end date: expiryTimeMillis is attacker-visible in the sense that
    // a malformed/oversized value would otherwise grant an unbounded term.
    const planEnd = planEndDate(now, planDetails.duration).getTime();
    const googleEnd = Number(purchase.expiryTimeMillis) || planEnd;
    const MAX_TERM_MS = 400 * 86400000; // Google's longest base plan + slack
    const endDate = new Date(Math.min(googleEnd, now.getTime() + MAX_TERM_MS));

    const sub = await Subscription.create({
      userId,
      planType,
      // Reuse existing columns so no migration is needed: order = productId,
      // paymentId = purchaseToken (also the idempotency key).
      razorpayOrderId: `gplay_${productId}`,
      razorpayPaymentId: purchaseToken,
      razorpaySignature: 'GOOGLE_PLAY',
      status: 'active',
      startDate: now,
      endDate,
      amount: (planDetails.amount != null ? planDetails.amount / 100 : 0),
      contactUnlocksAllowed: planDetails.contactUnlocks,
      contactUnlocksUsed: 0,
    }, { transaction: t });

    await applyPendingCredits(userId, sub, t);

    // Supersede any other pending/active subscription (upgrade-from tier).
    await Subscription.update(
      { status: 'cancelled' },
      {
        where: { userId, status: { [Op.in]: ['pending', 'active'] }, id: { [Op.ne]: sub.id } },
        transaction: t,
      }
    );

    return sub;
  });

  logAudit('subscription_activated_googleplay', userId, {
    subscriptionId: subscription.id,
    planType: subscription.planType,
    productId,
    endDate: subscription.endDate,
  });

  await markLeadPaid(subscription);

  if (UNLIMITED_PLANS.includes(subscription.planType)) {
    await User.update(
      { isBoosted: true, boostExpiresAt: new Date(subscription.endDate) },
      { where: { id: userId } }
    );
  }

  res.json({
    success: true,
    message: 'Google Play purchase verified and subscription activated',
    subscription,
  });
});

// @route   GET /api/subscription/my-subscription
// @desc    Get current user's subscription
// @access  Private
exports.getMySubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Only an ACTIVE row describes what the member currently has. Taking the most
  // recently created row of any status meant that starting an upgrade and never
  // paying (status 'pending'), or an old 'cancelled' row, was reported as the
  // current plan — the UI showed "VIP" while the server correctly granted
  // nothing, because entitlement checks filter on status:'active'.
  const subscription = await Subscription.findOne({
    where: { userId, status: 'active' },
    order: [['createdAt', 'DESC']]
  });

  const free = { planType: 'free', status: 'active' };

  if (!subscription) {
    return res.json({ success: true, subscription: free });
  }

  // Check if subscription expired and update status
  if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
    subscription.status = 'expired';
    await subscription.save();
    return res.json({ success: true, subscription: free });
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
  // Human-readable marketing bullets per tier. Price/tenure/unlocks/mrp/badge
  // are pulled from the razorpay PLANS map (single source of truth) so the two
  // never drift; only the display copy lives here.
  // Bullets are BUILT from the effective plan, never hardcoded: the launch
  // offer changes unlock counts and tenures at runtime, and a frozen string
  // ("5 contact unlocks", "Full-year validity") silently becomes a false claim
  // on the card the moment pricing moves.
  const unlockLine = (p) => (p.contactUnlocks === null ? 'Unlimited contact unlocks' : `${p.contactUnlocks} contact unlocks`);
  const validityLine = (p) => (p.endsOn
    ? `Full access until ${memberDate(p.endsOn)}`
    : `${p.durationLabel} of full access`);

  // `prevName` is the tier BELOW this one that is actually being shown, not the
  // one below it in the enum. The launch offer can withdraw a tier, and a card
  // reading "Everything in Elite" beside a page with no Elite card is a
  // dangling reference the reader cannot resolve.
  const FEATURE_COPY = (key, p, prevName) => ({
    basic_premium: [
      'View contact details',
      'Unlimited messages',
      'See who viewed profile',
      'Advanced search filters',
      unlockLine(p),
    ],
    premium_plus: [
      prevName ? `Everything in ${prevName}` : 'Everything in Free',
      unlockLine(p),
      validityLine(p),
      'Profile boost',
      'Spotlight listing',
      'Priority customer support',
    ],
    elite: [
      prevName ? `Everything in ${prevName}` : 'Everything in Free',
      unlockLine(p),
      'Priority ranking in search',
      validityLine(p),
    ],
    vip: [
      prevName ? `Everything in ${prevName}` : 'Everything in Free',
      unlockLine(p),
      'Verified badge',
      validityLine(p),
      'Dedicated relationship advisor',
    ],
    nri: [
      prevName ? `Everything in ${prevName}` : 'Everything in Free',
      unlockLine(p),
      'Priority NRI support',
      'Timezone-aware matching',
      'Prices shown in your local currency',
    ],
  }[key] || []);

  // perMonth (rupees, rounded) = price / (durationDays / 30)
  const perMonth = (rupees, durationDays) =>
    Math.round(rupees / (durationDays / 30));

  const plans = {
    free: {
      name: 'Free',
      price: 0,
      duration: 'Unlimited',
      contactUnlocks: 0,
      features: [
        'Create profile',
        'Browse matches',
        'Send interest',
        'Basic search filters',
      ],
    },
  };

  // Build every paid tier from the EFFECTIVE plan (regular tier with the launch
  // offer overlaid when one is running) — the same read `createOrder` charges
  // from, so the card can never advertise a price the checkout won't honour.
  // Resolve the visible ladder first: the "Everything in X" line on each card
  // has to name the tier the reader can actually see above it.
  const visible = [];
  for (const key of ['basic_premium', 'premium_plus', 'elite', 'vip', 'nri']) {
    const p = getPlanDetails(key);
    if (!p) continue;
    // Withdrawn for the launch window — `createOrder` refuses it, so it must
    // not appear as a card either. getPlanDetails still resolves it (existing
    // subscribers on that tier keep working); `hidden` is the purchase gate.
    if (p.hidden) continue;
    visible.push([key, p]);
  }

  // NRI Connect is a parallel segment tier, not the top of the ladder, so it
  // never supplies the "Everything in X" reference for the tier after it.
  const ladder = visible.filter(([key]) => key !== 'nri');

  for (const [key, p] of visible) {
    const ladderIdx = ladder.findIndex(([k]) => k === key);
    const prevName = key === 'nri'
      ? (ladder.length ? ladder[ladder.length - 1][1].name : null)
      : (ladderIdx > 0 ? ladder[ladderIdx - 1][1].name : null);
    const price = p.amount / 100;
    // A fixed launch term runs to a date, so the honest length is the days
    // from today to that date, not the configured duration.
    const termDays = p.endsOn
      ? Math.max(1, Math.ceil((Date.parse(p.endsOn) - Date.now()) / 86400000))
      : p.duration;
    plans[key] = {
      name: p.name,
      price,
      mrp: p.mrp ? p.mrp / 100 : null,
      perMonth: perMonth(price, termDays),
      duration: p.endsOn ? `until ${memberDate(p.endsOn)}` : p.durationLabel,
      durationDays: termDays,
      endsOn: p.endsOn || null,
      contactUnlocks: p.contactUnlocks === null ? -1 : p.contactUnlocks,
      // Only meaningful when contactUnlocks is unlimited (-1). "Unlimited" is
      // capped in practice — middlewares/auth.js `checkContactUnlockLimit`
      // enforces a rolling-24h ceiling on unlimited tiers as an anti-harvest
      // measure — and that cap was previously disclosed nowhere a buyer could
      // read it. Null for finite plans, where it does not apply.
      unlockDailyCap: p.contactUnlocks === null ? (config.limits?.unlimitedDailyUnlockCap ?? 25) : null,
      popular: p.popular || false,
      badge: p.badge || null,
      // Launch-offer provenance for the pricing UI: `isLaunchPrice` drives the
      // offer chip, `regularPrice` names what it reverts to.
      isLaunchPrice: Boolean(p.isLaunchPrice),
      regularPrice: p.regularAmount ? p.regularAmount / 100 : null,
      regularDurationDays: p.regularDuration || null,
      // Audience marker. This endpoint is PUBLIC (no req.user), so the server
      // cannot filter by residency — it labels instead and the clients hide a
      // segment card from members it does not apply to. NRI Connect is a
      // parallel tier, not a rung: shown to everyone it just becomes a fifth
      // card that every buyer has to read and rule out.
      segment: key === 'nri' ? 'nri' : null,
      features: FEATURE_COPY(key, p, prevName),
    };
  }

  // Unlock top-ups, minus any bundle withdrawn for the launch window.
  const bundles = {};
  for (const id of Object.keys(UNLOCK_BUNDLES)) {
    const b = getBundleDetails(id);
    if (!b) continue;
    bundles[id] = {
      bundleId: id,
      name: b.name,
      unlocks: b.unlocks,
      price: b.amount / 100,
      mrp: b.mrp ? b.mrp / 100 : null,
      isLaunchPrice: Boolean(b.isLaunchPrice),
    };
  }

  const founding = getFoundingState();

  res.json({
    success: true,
    plans,
    bundles,
    // Launch-offer state (admin-editable, time-boxed). `active:false` means the
    // regular ladder is what is being served — surfaces must not promise a
    // discount off this.
    launchOffer: getOfferState(),
    // Public founding-window state (Phase S). This is the ONLY public source of
    // truth for "may a surface promise a free premium period?" — the landing
    // band, the city pages and the signup kicker all read it and default to
    // CLOSED. Fail-closed matters: `FOUNDING_PERIOD_ENDS` unset means no grant
    // ever fires (utils/foundingGrant.js), so a surface that assumed "open"
    // would promise an entitlement nobody receives. `contactUnlocks` is echoed
    // so the copy can name the real cap instead of hand-waving "premium".
    founding: {
      open: founding.open,
      endsAt: founding.endsAt,
      contactUnlocks: founding.contactUnlocks,
      grantDays: founding.grantDays,
    },
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
    await activateCapturedPayment(order_id, payment_id);
  } else if (event === 'payment.failed') {
    const { order_id, error_description } = payload.payment.entity;

    const subscription = await Subscription.findOne({
      where: { razorpayOrderId: order_id }
    });

    // The order stays PENDING. A Razorpay order takes several payment attempts
    // and the checkout lets the member retry in place, so a failed attempt is
    // not the end of it: this handler used to cancel the row on the first
    // failure, and a retry that then succeeded was rejected by verify-payment
    // ("Subscription not found") or ignored by the captured webhook — paid,
    // and no plan. Pending is now reserved for exactly this: a payment problem
    // that may still resolve. The failure is recorded so the lifecycle job can
    // send the one help mail, and the sweeper closes it after a week.
    if (subscription && subscription.status === 'pending') {
      const ledger = subscription.lifecycleMail || {};
      if (!ledger.paymentFailedAt) {
        subscription.lifecycleMail = { ...ledger, paymentFailedAt: new Date().toISOString() };
        await subscription.save();
      }

      log.warn('Payment failed', {
        subscriptionId: subscription.id,
        orderId: order_id,
        reason: error_description
      });
    }
  } else if (event === 'refund.processed') {
    const refund = payload?.refund?.entity;
    if (refund) {
      await recordRefund({ paymentId: refund.payment_id, refundId: refund.id, amountPaise: refund.amount, source: 'webhook' });
    }
  } else if (event === 'refund.failed') {
    const refund = payload?.refund?.entity;
    log.error('Razorpay refund failed', { refundId: refund?.id, paymentId: refund?.payment_id });
    logAudit('refund_failed', null, { refundId: refund?.id, paymentId: refund?.payment_id });
  } else if (typeof event === 'string' && event.startsWith('payment.dispute.')) {
    const dispute = payload?.dispute?.entity;
    if (dispute) {
      await recordDispute({
        paymentId: dispute.payment_id,
        disputeId: dispute.id,
        // 'payment.dispute.created' carries status 'open'; won/lost/closed carry theirs.
        status: dispute.status || event.split('.').pop(),
      });
    }
  }

  // Always return 200 to acknowledge webhook
  res.json({ success: true });
});

// @route   GET /api/subscription/history
// @desc    Get current user's payment/subscription history
// @access  Private
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.findAll({
    where: {
      userId: req.user.id,
      // A cancelled row with no payment id is a checkout that was closed
      // before anyone paid — not a transaction, and listing it makes every
      // abandoned attempt look like a payment on the member's own history.
      [Op.or]: [
        { status: { [Op.in]: ['active', 'expired'] } },
        { status: 'cancelled', razorpayPaymentId: { [Op.ne]: null } },
      ],
    },
    order: [['createdAt', 'DESC']],
    attributes: [
      'id', 'planType', 'status', 'amount', 'refundedAmount', 'refundedAt',
      'startDate', 'endDate', 'razorpayPaymentId', 'razorpayOrderId', 'createdAt',
    ],
  });

  res.json({ success: true, subscriptions });
});

// @route   GET /api/subscription/invoice/:subscriptionId
// @desc    Download invoice PDF for a specific subscription (user's own only)
// @access  Private
exports.getInvoice = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;

  const subscription = await Subscription.findOne({
    where: { id: subscriptionId, userId: req.user.id },
    include: [{
      model: User,
      attributes: ['id', 'email'],
      include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
    }],
  });

  if (!subscription) throw createError.notFound('Subscription not found');
  const blocked = invoiceBlocker(subscription);
  if (blocked) throw createError.badRequest(blocked);

  generateInvoicePDF(res, {
    subscription,
    user: subscription.User,
    profile: subscription.User?.Profile,
  });
});

// @route   DELETE /api/subscription/current
// @desc    Cancel the current active subscription. Access ends immediately —
//          status flips to 'cancelled' and every entitlement read in this
//          codebase (`requirePremium`, `requireVIP`, `hasChatAccess`, …)
//          requires status:'active', so there is no grace period baked into
//          this endpoint.
// @access  Private
//
// This used to also compute and fire an automatic pro-rata Razorpay refund on
// every cancellation. Removed outright (not patched) because it was quietly
// MORE generous than what we publish: our own Refund & Conduct Policy
// (frontend `RefundPolicy.jsx`) and Terms §13 both say a membership runs its
// full term and the unused part is not refunded — a full refund is a manual,
// seven-day-window request handled by a human over email, not an automatic
// consequence of hitting this endpoint. The old computation also floored
// "value delivered" at unlock-usage 0 for every UNLIMITED plan
// (contactUnlocksAllowed === null → unlocksUnusedFraction = 1, i.e. refund is
// time-only), and since 2026-08-22 the only plan on sale (`premium_plus`) is
// exactly that: unlimited unlocks. Buy it, drain the rolling
// `UNLIMITED_DAILY_UNLOCK_CAP` (25/day) for ten days, cancel on day 10 of 90,
// and ~89% of the price came back after ~250 phone numbers were already
// taken — repeatable with a fresh account. A genuine refund is now always a
// deliberate admin decision: POST /admin/subscriptions/:subscriptionId/refund.
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const subscription = await Subscription.findOne({
    where: { userId, status: 'active', endDate: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });

  if (!subscription) {
    throw createError.notFound('No active subscription to cancel');
  }

  await sequelize.transaction(async (t) => {
    subscription.status = 'cancelled';
    await subscription.save({ transaction: t });

    // Deactivate boost if this plan granted it
    await User.update(
      { isBoosted: false, boostExpiresAt: null },
      { where: { id: userId }, transaction: t }
    );
  });

  logAudit('subscription_cancelled', userId, {
    subscriptionId: subscription.id,
    planType: subscription.planType,
  });

  res.json({
    success: true,
    message: 'Your subscription has been cancelled and premium access has ended immediately. Cancelling does not automatically refund the unused part of your term — see our Refund & Conduct Policy, or contact support if you believe you qualify for one.',
    subscription: {
      id: subscription.id,
      planType: subscription.planType,
      status: subscription.status,
      endDate: subscription.endDate,
    },
    // Kept for response-shape compatibility with any client that reads this
    // field: cancellation never issues a refund now, so it is always null. A
    // genuine refund is a separate, deliberate admin action — see
    // POST /admin/subscriptions/:subscriptionId/refund.
    refund: null,
  });
});

// Find the buyer's single active FINITE (non-unlimited) subscription, or null.
// Bundles ride this row, so an unlimited plan (VIP/NRI) can't buy top-ups.
const findActiveFiniteSubscription = async (userId, transaction) => {
  const sub = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      endDate: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
    transaction,
    ...(transaction ? { lock: true } : {}),
  });
  return sub;
};

// @route   POST /api/subscription/unlock-bundle/create-order
// @desc    Buy an à-la-carte contact-unlock top-up (requires an active finite plan)
// @access  Private (requirePremium)
exports.createBundleOrder = asyncHandler(async (req, res) => {
  const { bundleId } = req.body;
  const userId = req.user.id;

  if (!config.razorpay.isConfigured()) {
    throw createError.internal('Payment gateway is not configured');
  }

  const bundle = getBundleDetails(bundleId);
  if (!bundle) {
    throw createError.badRequest('Invalid bundle');
  }

  // requirePremium guarantees an active paid sub in req.subscription, but that
  // includes unlimited plans — bundles make no sense there.
  const active = req.subscription;
  if (!active) {
    throw createError.forbidden('An active subscription is required to buy unlock top-ups', 'PREMIUM_REQUIRED');
  }
  if (active.contactUnlocksAllowed === null) {
    throw createError.badRequest('Your plan already includes unlimited contact unlocks');
  }

  const order = await razorpayCreateBundleOrder(bundleId, userId);

  await UnlockPurchase.create({
    userId,
    bundleId,
    unlocks: bundle.unlocks,
    amount: bundle.amount / 100,
    razorpayOrderId: order.orderId,
    status: 'pending',
  });

  logAudit('unlock_bundle_order_created', userId, { bundleId, orderId: order.orderId });

  res.json({
    success: true,
    order: {
      id: order.orderId,
      amount: order.amount,
      currency: order.currency,
    },
    bundle: { bundleId, unlocks: bundle.unlocks },
  });
});

// @route   POST /api/subscription/unlock-bundle/verify-payment
// @desc    Verify a bundle payment and credit unlocks to the active subscription
// @access  Private (requirePremium)
exports.verifyBundlePayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const userId = req.user.id;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw createError.badRequest('Missing payment details');
  }

  const isValid = razorpayVerifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    log.warn('Bundle payment signature verification failed', { userId, razorpayOrderId });
    throw createError.badRequest('Payment verification failed');
  }

  const result = await sequelize.transaction(async (t) => {
    const purchase = await UnlockPurchase.findOne({
      where: { razorpayOrderId, userId },
      transaction: t,
      lock: true,
    });

    if (!purchase) {
      throw createError.notFound('Purchase not found');
    }

    // Idempotency — already credited.
    if (purchase.status === 'active') {
      return purchase;
    }

    const active = await findActiveFiniteSubscription(userId, t);
    if (!active) {
      throw createError.badRequest('No active subscription to credit unlocks to');
    }
    if (active.contactUnlocksAllowed === null) {
      throw createError.badRequest('Your plan already includes unlimited contact unlocks');
    }

    active.contactUnlocksAllowed += purchase.unlocks;
    await active.save({ transaction: t });

    purchase.razorpayPaymentId = razorpayPaymentId;
    purchase.status = 'active';
    await purchase.save({ transaction: t });

    return purchase;
  });

  logAudit('unlock_bundle_credited', userId, {
    purchaseId: result.id,
    bundleId: result.bundleId,
    unlocks: result.unlocks,
  });

  res.json({
    success: true,
    message: `${result.unlocks} contact unlocks added to your plan`,
    unlocks: result.unlocks,
  });
});


/**
 * POST /subscription/claim-founding
 *
 * The founding grant is minted at SIGNUP (utils/foundingGrant.js), which left a
 * gap: every account created BEFORE the window opened never received it, and
 * the offer is advertised as "the first N members" — not "the first N members
 * who happened to sign up on the right day". This lets one of those members
 * take the place they were promised, while the window is open and under cap.
 *
 * Gates, in order, all of them refusals rather than silent no-ops so the UI can
 * say why:
 *   1. window open           (settings-backed, fail-closed)
 *   2. never claimed before  (`Users.isFoundingMember` outlives the row, so an
 *                            expired grant cannot be re-claimed in a loop)
 *   3. no active plan        (a paying member must not be downgraded onto a
 *                            free grant, and the grant must not stack)
 *   4. cap not reached       (enforced inside grantFoundingIfOpen)
 */
exports.claimFounding = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const founding = getFoundingState();
  if (!founding.open) {
    throw createError.badRequest('The founding offer has closed');
  }

  // Check-then-act under a row lock. Four concurrent claims for one member
  // each passed the isFoundingMember / no-active-plan checks and each minted a
  // founding_premium row. Locking the USER row serialises a member's own claims:
  // the second waits, re-reads isFoundingMember (now true, set in the same
  // transaction by the grant) and is refused.
  const outcome = await sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'isFoundingMember'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) {
      throw createError.notFound('User not found');
    }
    if (user.isFoundingMember) {
      throw createError.conflict('You have already claimed the founding offer', 'FOUNDING_ALREADY_CLAIMED');
    }

    const active = await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        endDate: { [Op.gt]: new Date() },
      },
      transaction: t,
    });
    if (active) {
      throw createError.conflict('You already have an active plan', 'SUBSCRIPTION_ACTIVE');
    }

    return grantFoundingIfOpen(userId, { transaction: t });
  });

  if (!outcome) {
    // grantFoundingIfOpen swallows its own failures by contract, so the only
    // thing distinguishable here is "no place left" versus an internal fault.
    throw createError.conflict(
      'All founding places have been taken',
      'FOUNDING_CAP_REACHED'
    );
  }

  const subscription = await Subscription.findOne({
    where: { userId, planType: FOUNDING_PLAN, status: 'active' },
    order: [['createdAt', 'DESC']],
  });

  log.info('Founding offer claimed', { userId });

  res.json({
    success: true,
    message: `You're a founding member — ${founding.grantDays} days of premium, on us.`,
    subscription,
  });
});
