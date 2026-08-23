'use strict';

/**
 * Launch-offer pricing layer (admin-editable, time-boxed).
 *
 * WHY THIS EXISTS
 * The regular ladder in `utils/razorpay.js` PLANS is priced for a liquid
 * marketplace (₹1,299–₹9,999). At launch the site has almost no profiles, so
 * willingness-to-pay is near zero at those numbers. This module overlays a
 * cheaper, SHORTER-tenure ladder on top of the regular one for a bounded
 * window, and the owner edits it from the admin panel — no redeploy, no env.
 *
 * CONTRACT — read this before touching prices anywhere else:
 *  - `utils/razorpay.js` is still the single source of truth for the REGULAR
 *    ladder. This module only overrides `amount` / `duration` /
 *    `contactUnlocks` / `mrp` while the offer is active.
 *  - Everything money-shaped already reads `getPlanDetails()` /
 *    `createOrder()` / `getBundleDetails()`, so overlaying inside razorpay.js
 *    (which is what happens) means the charged amount, the displayed price and
 *    the tenure written onto the Subscription row can never disagree.
 *  - Reads are SYNCHRONOUS off an in-process cache because `getPlanDetails()`
 *    is sync and is called inside payment transactions. The cache is warmed at
 *    boot (`initLaunchOffer()`), rewritten on every admin save, and lazily
 *    revalidated at most once per CACHE_TTL_MS. A stale read can only ever be
 *    up to TTL old, and the write path refreshes immediately, so a price edit
 *    is live for the editing admin at once.
 *  - The offer is FAIL-CLOSED-TO-REGULAR: any load failure, malformed blob or
 *    passed deadline falls back to regular pricing. The failure mode is
 *    "member is charged the normal price", never "member is charged nothing".
 */

const { log } = require('../middlewares/logger');
const config = require('../config/env');

const SETTINGS_KEY = 'launch_offer';
const CACHE_TTL_MS = 60 * 1000;
const DEFAULT_WINDOW_DAYS = 90;

/**
 * Launch ladder — ONE plan on sale.
 *
 * At launch the site has a few hundred profiles, so the thing a buyer is
 * actually deciding is "is this worth ₹1,199 at all", not "which of five
 * tiers". Every extra card turns that single question into a multi-variable
 * comparison (price × tenure × unlock count) that a buyer abandons rather than
 * solves, and with this little supply the differentiators between tiers are
 * ones nobody can feel yet. So: one 90-day plan with UNLIMITED contact
 * unlocks at ₹1,199, and every other tier withdrawn.
 *
 * Withdrawn is not merely un-rendered — `overlayPlan` marks the tier
 * `hidden`, `isPlanPurchasable` reads that, and `createOrder` refuses it. A
 * stale app build or a hand-crafted request cannot buy a tier that is off
 * sale. `getPlanDetails` still RESOLVES withdrawn tiers, so members already
 * holding one keep working (invoices, my-subscription, the webhook).
 *
 * Which tiers are on sale is an admin decision from here on — Admin → Pricing
 * & Offers toggles each of the five, subject to MAX_VISIBLE_PAID_PLANS below.
 * `premium_plus` is the one left standing because its enum key already reads
 * "Premium", it is natively the 90-day rung, and it carries the profile-boost
 * and spotlight entitlements the copy promises.
 *
 * Unlimited unlocks costs nothing to give while supply is the binding
 * constraint, and the rolling-24h ceiling in `middlewares/auth.js`
 * (UNLIMITED_DAILY_UNLOCK_CAP) is what actually stops phone-number harvesting
 * — not the per-plan number.
 *
 * `amount` and `mrp` are PAISE. `duration` is days. `contactUnlocks: null`
 * means unlimited — see `middlewares/auth.js` checkContactUnlockLimit.
 */
const DEFAULT_PLAN_OFFERS = {
  basic_premium: { hidden: true },
  premium_plus:  { amount: 119900, mrp: 249900, duration: 90, contactUnlocks: null },
  elite:         { hidden: true },
  vip:           { hidden: true },
  nri:           { hidden: true },
};

/**
 * Ceiling on how many PAID cards may be on sale at once. Free is always
 * rendered and is not a launch-offer tier, so the pricing page tops out at
 * six cards — the five paid tiers (NRI included) plus Free. Enforced in
 * `saveOffer` rather than left to the shape of the enum, so adding a sixth
 * paid tier later cannot quietly push the page to seven.
 */
const MAX_VISIBLE_PAID_PLANS = 5;

/**
 * Unlock top-ups must stay priced ABOVE every FINITE plan's per-unlock rate,
 * or buying bundles beats subscribing. With the single launch plan selling
 * UNLIMITED unlocks there is no finite paid tier to invert against, so the
 * floor is currently vacuous — these stay reachable for founding-grant members
 * (a finite 3-unlock entitlement) and for any finite tier an admin puts back
 * on sale. If a finite tier is re-enabled below ~66/unlock, reprice these.
 *
 * bundle_25 is HIDDEN during the launch window: any price that clears the
 * per-unlock floor lands at or above the plan price itself, which would make
 * stacking bundles beat subscribing — the exact inversion the floor exists to
 * prevent. Hidden bundles are rejected at purchase, not merely un-rendered.
 */
const DEFAULT_BUNDLE_OFFERS = {
  bundle_3:  { amount: 19900 },
  bundle_10: { amount: 54900 },
  bundle_25: { hidden: true },
};

// Founding-member grant while the window is open. A 30-day premium-grade taste
// with 3 contact unlocks for the first 500 accounts. `contactUnlocks` must be a
// finite number — NULL means UNLIMITED downstream, which would hand every
// self-signup a scriptable phone-number harvest.
const DEFAULT_FOUNDING = {
  enabled: true,
  memberCap: 500,
  grantDays: 30,
  contactUnlocks: 3,
  endsAt: null, // seeded to the offer deadline on first boot
};

const buildDefaults = (now = new Date()) => {
  const endsAt = new Date(now.getTime() + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return {
    enabled: true,
    endsAt,
    headline: 'Launch offer',
    subline: 'Founding-price plans while we grow the Tricity community.',
    plans: JSON.parse(JSON.stringify(DEFAULT_PLAN_OFFERS)),
    bundles: JSON.parse(JSON.stringify(DEFAULT_BUNDLE_OFFERS)),
    founding: { ...DEFAULT_FOUNDING, endsAt },
  };
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cached = null;        // last known-good offer blob
let cachedAt = 0;         // ms epoch of the last successful load
let refreshing = false;   // in-flight guard for the lazy revalidate
// Set once `__setCacheForTests` is used. The lazy revalidate below fires off an
// un-awaited DB read whenever the cache is stale — and `__setCacheForTests(null)`
// makes it stale by definition — so a suite that injects a blob would leave a
// Sequelize connect in flight, landing after Jest tears the environment down
// ("require a file after the Jest environment has been torn down", then a hard
// crash inside pg). Tests own the cache outright; they never want a refresh.
let cacheInjected = false;

const readFromDb = async () => {
  // Lazy require: keeps this module unit-testable without a live Sequelize
  // connection (same reason controllers require models lazily).
  const { AppSetting } = require('../models');
  const row = await AppSetting.findByPk(SETTINGS_KEY);
  return row ? row.value : null;
};

const scheduleRefresh = () => {
  if (cacheInjected) return;
  if (refreshing) return;
  if (Date.now() - cachedAt < CACHE_TTL_MS) return;
  refreshing = true;
  readFromDb()
    .then((value) => {
      if (value) {
        cached = value;
        cachedAt = Date.now();
      }
    })
    .catch((err) => log.warn('Launch offer refresh failed (serving cached)', { error: err.message }))
    .finally(() => { refreshing = false; });
};

/**
 * Warm the cache and seed the row on first ever boot. Called from server.js.
 * NEVER throws into the caller: a settings failure must not stop the server,
 * it just means regular pricing.
 */
const initLaunchOffer = async () => {
  try {
    const existing = await readFromDb();
    if (existing) {
      cached = existing;
      cachedAt = Date.now();
      return cached;
    }
    const { AppSetting } = require('../models');
    const defaults = buildDefaults();
    await AppSetting.create({ key: SETTINGS_KEY, value: defaults });
    cached = defaults;
    cachedAt = Date.now();
    log.info('Launch offer seeded', { endsAt: defaults.endsAt });
    return cached;
  } catch (err) {
    log.warn('Launch offer init failed — regular pricing in effect', { error: err.message });
    return null;
  }
};

/** Raw stored blob (defaults if nothing has loaded yet). Sync. */
const getOffer = () => {
  scheduleRefresh();
  return cached;
};

const isWindowOpen = (endsAt) => {
  if (!endsAt) return true; // no deadline set = runs until switched off
  const t = Date.parse(endsAt);
  return Number.isFinite(t) && t > Date.now();
};

/** Is the launch offer live right now? Sync. */
const isOfferActive = () => {
  const offer = getOffer();
  return Boolean(offer && offer.enabled && isWindowOpen(offer.endsAt));
};

/** Public offer state for API responses. */
const getOfferState = () => {
  const offer = getOffer();
  const active = isOfferActive();
  return {
    active,
    endsAt: active ? (offer?.endsAt || null) : null,
    headline: active ? (offer?.headline || 'Launch offer') : null,
    subline: active ? (offer?.subline || null) : null,
  };
};

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

/**
 * Merge the launch override for one plan onto its regular definition.
 * Returns the base plan untouched when the offer is off, the tier has no
 * override, or the override is malformed.
 *
 * A WITHDRAWN tier resolves to the regular plan carrying `hidden: true` — it
 * is deliberately NOT null. Two different questions are asked of this
 * function: "what may a member buy" (getPlans, createOrder — these must honour
 * `hidden`) and "what does this existing subscription mean" (my-subscription,
 * invoices, the webhook, admin grants — these must still resolve, or hiding a
 * tier would break every member already holding it). Returning null would
 * silently answer the second question wrong.
 */
const overlayPlan = (planType, basePlan) => {
  if (!basePlan) return basePlan;
  if (!isOfferActive()) return basePlan;

  const o = getOffer()?.plans?.[planType];
  if (o && o.hidden) return { ...basePlan, hidden: true };
  if (!o || !isPositiveInt(o.amount) || !isPositiveInt(o.duration)) return basePlan;

  // `contactUnlocks` is only honoured when explicitly present AND either null
  // (unlimited) or a non-negative integer. An absent/garbage value keeps the
  // regular cap rather than silently widening it.
  const unlocks = Object.prototype.hasOwnProperty.call(o, 'contactUnlocks')
    ? o.contactUnlocks
    : basePlan.contactUnlocks;
  const safeUnlocks = unlocks === null || (Number.isInteger(unlocks) && unlocks >= 0)
    ? unlocks
    : basePlan.contactUnlocks;

  return {
    ...basePlan,
    amount: o.amount,
    duration: o.duration,
    durationLabel: durationLabel(o.duration),
    contactUnlocks: safeUnlocks,
    // Strike-through anchor: the launch override's own mrp, else the regular
    // price prorated to the shorter launch tenure.
    mrp: isPositiveInt(o.mrp)
      ? o.mrp
      : Math.round((basePlan.amount * o.duration) / basePlan.duration),
    isLaunchPrice: true,
    regularAmount: basePlan.amount,
    regularDuration: basePlan.duration,
  };
};

const durationLabel = (days) => {
  if (days % 360 === 0) return `${days / 360} year${days > 360 ? 's' : ''}`;
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? '1 month' : `${months} months`;
  }
  return `${days} days`;
};

/** Merge the launch override for one unlock bundle. Hidden → null. */
const overlayBundle = (bundleId, baseBundle) => {
  if (!baseBundle) return baseBundle;
  if (!isOfferActive()) return baseBundle;

  const o = getOffer()?.bundles?.[bundleId];
  if (!o) return baseBundle;
  if (o.hidden) return null; // withdrawn for the launch window
  if (!isPositiveInt(o.amount)) return baseBundle;

  return { ...baseBundle, amount: o.amount, mrp: baseBundle.amount, isLaunchPrice: true };
};

// ---------------------------------------------------------------------------
// Founding window
// ---------------------------------------------------------------------------

/**
 * Effective founding-window state. Settings win; env
 * (FOUNDING_PERIOD_ENDS / FOUNDING_MEMBER_CAP) is the fallback so an existing
 * env-driven deployment keeps behaving exactly as before this module landed.
 */
const getFoundingState = () => {
  const f = getOffer()?.founding;
  if (f && typeof f === 'object') {
    const open = Boolean(f.enabled) && isWindowOpen(f.endsAt);
    return {
      open,
      endsAt: f.endsAt || null,
      memberCap: Number.isInteger(f.memberCap) && f.memberCap > 0 ? f.memberCap : 0,
      grantDays: isPositiveInt(f.grantDays) ? f.grantDays : DEFAULT_FOUNDING.grantDays,
      contactUnlocks: Number.isInteger(f.contactUnlocks) && f.contactUnlocks >= 0
        ? f.contactUnlocks
        : DEFAULT_FOUNDING.contactUnlocks,
      source: 'settings',
    };
  }
  // Fallback: the original env-only behaviour.
  return {
    open: config.founding.isOpen(),
    endsAt: config.founding.isOpen() ? config.founding.endsAt : null,
    memberCap: config.founding.memberCap || 0,
    grantDays: DEFAULT_FOUNDING.grantDays,
    contactUnlocks: DEFAULT_FOUNDING.contactUnlocks,
    source: 'env',
  };
};

// ---------------------------------------------------------------------------
// Admin write path
// ---------------------------------------------------------------------------

class OfferValidationError extends Error {}

const validPlanKeys = Object.keys(DEFAULT_PLAN_OFFERS);
const validBundleKeys = Object.keys(DEFAULT_BUNDLE_OFFERS);

const requireIsoDateOrNull = (v, field) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) {
    throw new OfferValidationError(`${field} must be an ISO date string or null`);
  }
  return new Date(v).toISOString();
};

/**
 * Validate + persist an offer blob. Rejects anything that could mis-charge a
 * member (zero/negative/absurd amounts, absurd tenures) or silently hand out
 * unlimited unlocks on a finite tier.
 */
const saveOffer = async (patch, adminId) => {
  if (!patch || typeof patch !== 'object') {
    throw new OfferValidationError('Offer payload required');
  }

  const current = getOffer() || buildDefaults();
  const next = {
    enabled: patch.enabled === undefined ? Boolean(current.enabled) : Boolean(patch.enabled),
    endsAt: patch.endsAt === undefined ? (current.endsAt || null) : requireIsoDateOrNull(patch.endsAt, 'endsAt'),
    headline: String(patch.headline ?? current.headline ?? 'Launch offer').slice(0, 80),
    subline: String(patch.subline ?? current.subline ?? '').slice(0, 200) || null,
    plans: {},
    bundles: {},
    founding: {},
  };

  const plansIn = patch.plans && typeof patch.plans === 'object' ? patch.plans : (current.plans || {});
  for (const key of validPlanKeys) {
    const src = plansIn[key] ?? current.plans?.[key];
    if (!src) continue;
    // A withdrawn tier carries no price to validate. Persisted as a bare
    // { hidden: true } so a later un-hide can't resurrect a stale amount.
    if (src.hidden) {
      next.plans[key] = { hidden: true };
      continue;
    }
    const amount = Number(src.amount);
    const duration = Number(src.duration);
    if (!isPositiveInt(amount) || amount > 10000000) {
      throw new OfferValidationError(`${key}: amount must be a positive integer in paise (≤ ₹1,00,000)`);
    }
    if (!isPositiveInt(duration) || duration > 730) {
      throw new OfferValidationError(`${key}: duration must be 1–730 days`);
    }
    let unlocks = src.contactUnlocks;
    if (unlocks === undefined) unlocks = null;
    if (unlocks !== null) {
      unlocks = Number(unlocks);
      if (!Number.isInteger(unlocks) || unlocks < 0 || unlocks > 10000) {
        throw new OfferValidationError(`${key}: contactUnlocks must be null (unlimited) or 0–10000`);
      }
    }
    const mrp = src.mrp === undefined || src.mrp === null ? null : Number(src.mrp);
    if (mrp !== null && (!isPositiveInt(mrp) || mrp < amount)) {
      throw new OfferValidationError(`${key}: mrp must be a positive integer ≥ the offer amount`);
    }
    next.plans[key] = { amount, duration, contactUnlocks: unlocks, ...(mrp ? { mrp } : {}) };
  }

  // A pricing page with nothing on it takes no money and gives the reader no
  // reason to come back — and unlike a bad price, nothing downstream fails
  // loudly when it happens, so it has to be refused here. A tier ABSENT from
  // the blob counts as visible: with no override it falls through to its
  // regular price, which is still on sale.
  const visibleCount = validPlanKeys.filter((k) => !next.plans[k]?.hidden).length;
  if (visibleCount === 0) {
    throw new OfferValidationError('At least one plan must stay on sale - hiding every tier leaves members with no way to pay.');
  }
  if (visibleCount > MAX_VISIBLE_PAID_PLANS) {
    throw new OfferValidationError(`At most ${MAX_VISIBLE_PAID_PLANS} paid plans may be on sale at once (Free is always shown, so that is ${MAX_VISIBLE_PAID_PLANS + 1} cards).`);
  }

  const bundlesIn = patch.bundles && typeof patch.bundles === 'object' ? patch.bundles : (current.bundles || {});
  for (const key of validBundleKeys) {
    const src = bundlesIn[key] ?? current.bundles?.[key];
    if (!src) continue;
    if (src.hidden) {
      next.bundles[key] = { hidden: true };
      continue;
    }
    const amount = Number(src.amount);
    if (!isPositiveInt(amount) || amount > 10000000) {
      throw new OfferValidationError(`${key}: amount must be a positive integer in paise`);
    }
    next.bundles[key] = { amount };
  }

  const fIn = patch.founding && typeof patch.founding === 'object' ? patch.founding : (current.founding || {});
  const grantDays = Number(fIn.grantDays ?? DEFAULT_FOUNDING.grantDays);
  // An EXPLICIT null is rejected rather than defaulted: null is the wire value
  // for "unlimited" everywhere else in this file, and an admin who typed it
  // meant unlimited — which on a free grant is a phone-number harvest.
  if (fIn.contactUnlocks === null) {
    throw new OfferValidationError('founding.contactUnlocks must be a finite number — unlimited free unlocks are not allowed');
  }
  const unlocks = Number(fIn.contactUnlocks ?? DEFAULT_FOUNDING.contactUnlocks);
  const cap = Number(fIn.memberCap ?? DEFAULT_FOUNDING.memberCap);
  if (!isPositiveInt(grantDays) || grantDays > 365) {
    throw new OfferValidationError('founding.grantDays must be 1–365');
  }
  // Finite and bounded, never null: null downstream means UNLIMITED unlocks.
  if (!Number.isInteger(unlocks) || unlocks < 0 || unlocks > 100) {
    throw new OfferValidationError('founding.contactUnlocks must be an integer 0–100');
  }
  if (!Number.isInteger(cap) || cap < 0 || cap > 1000000) {
    throw new OfferValidationError('founding.memberCap must be an integer ≥ 0 (0 = no cap)');
  }
  next.founding = {
    enabled: fIn.enabled === undefined ? Boolean(current.founding?.enabled) : Boolean(fIn.enabled),
    endsAt: fIn.endsAt === undefined
      ? (current.founding?.endsAt || null)
      : requireIsoDateOrNull(fIn.endsAt, 'founding.endsAt'),
    memberCap: cap,
    grantDays,
    contactUnlocks: unlocks,
  };

  const { AppSetting } = require('../models');
  await AppSetting.upsert({ key: SETTINGS_KEY, value: next, updatedBy: adminId || null });

  cached = next;
  cachedAt = Date.now();
  return next;
};

/**
 * Test seam — inject a blob without touching the DB. Also disables the lazy
 * background revalidate for the rest of the process: a test that owns the cache
 * must not have a DB read racing its teardown.
 */
const __setCacheForTests = (value) => {
  cached = value;
  cachedAt = value ? Date.now() : 0;
  cacheInjected = true;
};

module.exports = {
  SETTINGS_KEY,
  DEFAULT_PLAN_OFFERS,
  MAX_VISIBLE_PAID_PLANS,
  DEFAULT_BUNDLE_OFFERS,
  DEFAULT_FOUNDING,
  buildDefaults,
  initLaunchOffer,
  getOffer,
  getOfferState,
  isOfferActive,
  overlayPlan,
  overlayBundle,
  getFoundingState,
  saveOffer,
  OfferValidationError,
  durationLabel,
  __setCacheForTests,
};
