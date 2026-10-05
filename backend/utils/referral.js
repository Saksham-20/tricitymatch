'use strict';

/**
 * Checkout referral codes.
 *
 * A buyer types a code at checkout and takes a fixed amount off their FIRST plan
 * purchase. The code is either
 *
 *   - a MARKETING code (`ReferralCodes`, minted by a rep): the rep's reward is
 *     the commission they already earn on the buyer's payment — this module only
 *     makes sure the buyer is attributed to them (a lead exists), or
 *   - a MEMBER code (`Users.referralCode`): the referring member earns contact
 *     unlocks once the buyer's payment has actually landed.
 *
 * Everything is admin-editable through `utils/launchOffer` (`getReferralState`).
 *
 * WHY THE REWARD WAITS FOR THE PAYMENT
 * Signup already pays both sides of a member invite 3 unlocks (`inviteReward`);
 * that is cheap because it costs nothing until the buyer pays. This reward is the
 * larger one, so it is only released when real money has moved — a throwaway
 * account cannot mint it.
 *
 * ABUSE GATES (each cheap, none reachable by an honest buyer)
 *   - discount only on a buyer's first PAID purchase (`buyerHasPaidBefore`),
 *     so a code is not a recurring coupon and a member cannot loop referrals
 *     between two accounts of their own;
 *   - never your own code;
 *   - discount capped to a share of the plan price, on top of the admin ceiling;
 *   - unlock reward capped per referrer for life, and claimed exactly once per
 *     subscription by a conditional JSONB update (the webhook and the browser
 *     both activate the same order — whichever runs second must be a no-op).
 *
 * `settleReferral` never throws: it runs after a payment has been taken, and a
 * reward that fails must not turn a successful payment into an error.
 */

const crypto = require('crypto');
const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { log } = require('../middlewares/logger');
const config = require('../config/env');
const { getReferralState } = require('./launchOffer');
const { MEMBER_ROLE } = require('./memberRole');

// No 0/O/1/I — read aloud over a phone call or copied off a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MEMBER_CODE_LENGTH = 8; // 'TM' + 6
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

/** The discount is never more than this share of the plan's price. */
const MAX_DISCOUNT_SHARE = 0.3;
/** Lifetime ceiling on rewarded paid referrals per member. */
const MAX_REWARDED_PER_MEMBER = () => config.limits?.inviteRewardMaxPerInviter ?? 20;

class ReferralError extends Error {
  constructor(message, code = 'REFERRAL_INVALID') {
    super(message);
    this.code = code;
  }
}

const normaliseCode = (raw) => {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
};

const mintMemberCode = () => {
  const bytes = crypto.randomBytes(MEMBER_CODE_LENGTH - 2);
  let out = 'TM';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
};

/**
 * Return the member's referral code, minting one on first use. Lazy for the same
 * reason invite tokens are: signup stays a two-insert transaction and dormant
 * accounts never carry a code.
 */
const getOrCreateMemberCode = async (userId) => {
  if (!userId) return null;
  const { User, ReferralCode } = require('../models');

  const user = await User.findByPk(userId, { attributes: ['id', 'referralCode', 'role'] });
  // Member codes are for members: a staff account has none (partners have their
  // own marketing codes), and one minted earlier is never handed out.
  if (!user || user.role !== MEMBER_ROLE) return null;
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintMemberCode();
    // A marketing code with the same text would be shadowed (marketing resolves
    // first) — vanishingly unlikely, but cheap to rule out.
    if (await ReferralCode.findOne({ where: { code }, attributes: ['id'] })) continue;
    try {
      const [updated] = await User.update({ referralCode: code }, { where: { id: userId, referralCode: null } });
      if (updated > 0) return code;
      const fresh = await User.findByPk(userId, { attributes: ['referralCode'] });
      if (fresh?.referralCode) return fresh.referralCode;
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  log.warn('Could not mint a member referral code after retries', { userId });
  return null;
};

/**
 * Resolve a typed code to who it belongs to. Does not look at the buyer's
 * eligibility beyond refusing their own code — see `quoteReferral`.
 *
 * @returns {Promise<{kind:'marketing'|'member', code:string, marketingUserId?:string, referrerUserId?:string, referrerName?:string}>}
 * @throws {ReferralError}
 */
const resolveCode = async (rawCode, buyerId) => {
  const code = normaliseCode(rawCode);
  if (!code) throw new ReferralError('That referral code does not look right.');

  const { User, Profile, ReferralCode } = require('../models');

  const marketing = await ReferralCode.findOne({ where: { code, isActive: true } });
  if (marketing) {
    const rep = await User.findByPk(marketing.marketingUserId, { attributes: ['id', 'status'] });
    if (!rep || rep.status !== 'active') throw new ReferralError('That referral code is no longer active.');
    return { kind: 'marketing', code, marketingUserId: marketing.marketingUserId };
  }

  const owner = await User.findOne({
    where: { referralCode: code, status: 'active', role: MEMBER_ROLE },
    attributes: ['id'],
    include: [{ model: Profile, attributes: ['firstName'], required: false }],
  });
  if (!owner) throw new ReferralError('That referral code is not valid.');
  if (owner.id === buyerId) throw new ReferralError('You cannot use your own referral code.', 'REFERRAL_SELF');
  return {
    kind: 'member',
    code,
    referrerUserId: owner.id,
    referrerName: owner.Profile?.firstName || null,
  };
};

/** Has this buyer ever completed a paid plan purchase? Admin grants carry no payment id. */
const buyerHasPaidBefore = async (buyerId) => {
  const { Subscription } = require('../models');
  const n = await Subscription.count({
    where: { userId: buyerId, razorpayPaymentId: { [Op.ne]: null } },
  });
  return n > 0;
};

/**
 * What a code is worth on a given plan, for a given buyer.
 *
 * @param {object} plan  effective plan from `getPlanDetails` (amount in paise)
 * @returns {Promise<{ referral: object, discountPaise: number, finalPaise: number }>}
 * @throws {ReferralError}
 */
const quoteReferral = async (rawCode, plan, buyerId) => {
  const cfg = getReferralState();
  if (!cfg.enabled || cfg.discountPaise <= 0) {
    throw new ReferralError('Referral codes are not available right now.', 'REFERRAL_DISABLED');
  }
  if (!plan || !Number.isInteger(plan.amount) || plan.amount <= 0) {
    throw new ReferralError('That plan is not available right now.');
  }
  if (await buyerHasPaidBefore(buyerId)) {
    throw new ReferralError('Referral codes are for your first plan purchase.', 'REFERRAL_NOT_FIRST');
  }

  const resolved = await resolveCode(rawCode, buyerId);

  const discountPaise = Math.min(cfg.discountPaise, Math.floor(plan.amount * MAX_DISCOUNT_SHARE));
  if (discountPaise <= 0) throw new ReferralError('That code does not apply to this plan.');

  return {
    referral: { ...resolved, discountPaise },
    discountPaise,
    finalPaise: plan.amount - discountPaise,
    referrerName: resolved.referrerName || null,
  };
};

/**
 * Release the reward for a paid, referral-carrying subscription. Idempotent and
 * never throws. Call AFTER the activating transaction has committed.
 */
const settleReferral = async (subscriptionId) => {
  try {
    const { Subscription, User, MarketingLead, ReferralCode, Profile } = require('../models');
    const sub = await Subscription.findByPk(subscriptionId);
    const ref = sub?.referral;
    if (!sub || !ref || ref.rewardedAt) return { settled: false };
    if (sub.status !== 'active' || !sub.razorpayPaymentId) return { settled: false };

    // Claim first. Two activation legs (browser verify + webhook) can reach this
    // at once; only the one whose UPDATE touches a row goes on to pay out.
    const [, claimed] = await sequelize.query(
      `UPDATE "Subscriptions"
          SET "referral" = "referral" || jsonb_build_object('rewardedAt', :now::text)
        WHERE "id" = :id AND "referral" IS NOT NULL AND "referral"->>'rewardedAt' IS NULL`,
      { replacements: { id: subscriptionId, now: new Date().toISOString() }, type: QueryTypes.UPDATE }
    );
    if (!claimed) return { settled: false };

    if (ref.kind === 'member' && ref.referrerUserId) {
      return await rewardMember(sub, ref);
    }
    if (ref.kind === 'marketing' && ref.marketingUserId) {
      await attributeToMarketing(sub, ref, { User, MarketingLead, ReferralCode, Profile });
      return { settled: true, kind: 'marketing' };
    }
    return { settled: true };
  } catch (err) {
    log.warn('Referral settlement failed (payment unaffected)', { subscriptionId, error: err.message });
    return { settled: false, error: err.message };
  }
};

async function rewardMember(sub, ref) {
  const { creditUnlocks } = require('./inviteReward');
  const cfg = getReferralState();

  const [{ n } = { n: 0 }] = await sequelize.query(
    `SELECT COUNT(*)::int AS n FROM "Subscriptions"
      WHERE "referral"->>'referrerUserId' = :referrer
        AND "referral"->>'rewardedAt' IS NOT NULL AND "id" <> :id`,
    { replacements: { referrer: ref.referrerUserId, id: sub.id }, type: QueryTypes.SELECT }
  );
  if (n >= MAX_REWARDED_PER_MEMBER()) {
    log.info('Referral reward skipped — referrer at lifetime cap', { referrer: ref.referrerUserId, n });
    return { settled: true, kind: 'member', rewarded: false, reason: 'cap' };
  }
  if (cfg.referrerUnlocks <= 0) return { settled: true, kind: 'member', rewarded: false };

  const result = await creditUnlocks(ref.referrerUserId, cfg.referrerUnlocks);
  if (result === 'failed') {
    // Release the claim so a later activation leg (or a re-run) can pay it.
    await sequelize.query(
      `UPDATE "Subscriptions" SET "referral" = "referral" - 'rewardedAt' WHERE "id" = :id`,
      { replacements: { id: sub.id }, type: QueryTypes.UPDATE }
    );
    return { settled: false, kind: 'member' };
  }

  // Record what was actually paid, so the member's panel reports the real
  // figure even after an admin changes the reward.
  await sequelize.query(
    `UPDATE "Subscriptions" SET "referral" = "referral" || jsonb_build_object('rewardUnlocks', :unlocks::int) WHERE "id" = :id`,
    { replacements: { id: sub.id, unlocks: cfg.referrerUnlocks }, type: QueryTypes.UPDATE }
  );

  try {
    const { notify } = require('./notifyUser');
    await notify(
      ref.referrerUserId,
      'system',
      'Your referral joined as a member',
      `${cfg.referrerUnlocks} contact unlock${cfg.referrerUnlocks === 1 ? '' : 's'} added to your account. Thank you for spreading the word.`,
      sub.userId
    );
  } catch (err) {
    log.warn('Referral reward notification failed (reward unaffected)', { error: err.message });
  }
  log.info('Referral reward issued', { referrer: ref.referrerUserId, buyer: sub.userId, unlocks: cfg.referrerUnlocks, result });
  return { settled: true, kind: 'member', rewarded: true };
}

/**
 * Make sure a marketing code used at checkout leaves the same trail a signup-time
 * code does, so the rep's report and commission pick the buyer up. FIRST TOUCH
 * WINS: a buyer already attributed to a rep at signup stays with that rep.
 */
async function attributeToMarketing(sub, ref, { User, MarketingLead, ReferralCode, Profile }) {
  const buyer = await User.findByPk(sub.userId, {
    attributes: ['id', 'email', 'phone', 'referredByMarketingUserId', 'referralCodeUsed'],
    include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
  });
  if (!buyer) return;

  let lead = await MarketingLead.findOne({ where: { convertedUserId: buyer.id } });
  if (!lead) {
    const name = [buyer.Profile?.firstName, buyer.Profile?.lastName].filter(Boolean).join(' ').trim();
    lead = await MarketingLead.create({
      name: name || 'Member',
      phone: buyer.phone || 'N/A',
      email: buyer.email || null,
      assignedToMarketingUserId: ref.marketingUserId,
      referralCode: ref.code,
      source: 'checkout_code',
      convertedUserId: buyer.id,
      status: 'contacted',
    });
    await ReferralCode.update(
      { usageCount: sequelize.literal('"usageCount" + 1') },
      { where: { code: ref.code } }
    );
  }
  if (!buyer.referredByMarketingUserId && lead.assignedToMarketingUserId === ref.marketingUserId) {
    await User.update(
      { referralCodeUsed: ref.code, referredByMarketingUserId: ref.marketingUserId },
      { where: { id: buyer.id, referredByMarketingUserId: null } }
    );
  }

  lead.paymentStatus = 'paid';
  lead.amountPaid = sub.amount;
  lead.paymentId = sub.razorpayPaymentId;
  lead.status = 'converted';
  await lead.save();
}

/**
 * The member's referral panel: their code, what it pays, how it is doing, and a
 * code to pre-fill at checkout (the one they signed up with, if any).
 */
const getReferralSummary = async (userId) => {
  const { User, Profile, ReferralCode } = require('../models');
  const cfg = getReferralState();

  const code = await getOrCreateMemberCode(userId);
  const me = await User.findByPk(userId, {
    attributes: ['id', 'referralCodeUsed', 'invitedBy', 'pendingUnlockCredits'],
  });

  const [signedUp, paidRow] = await Promise.all([
    User.count({ where: { invitedBy: userId } }),
    sequelize.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(("referral"->>'rewardUnlocks')::int), 0)::int AS unlocks
         FROM "Subscriptions"
        WHERE "referral"->>'referrerUserId' = :id AND "referral"->>'rewardedAt' IS NOT NULL`,
      { replacements: { id: userId }, type: QueryTypes.SELECT }
    ).then((rows) => rows[0] || { n: 0, unlocks: 0 }),
  ]);

  let prefill = null;
  if (me?.referralCodeUsed) {
    const rc = await ReferralCode.findOne({ where: { code: me.referralCodeUsed, isActive: true }, attributes: ['code'] });
    if (rc) prefill = rc.code;
  }
  if (!prefill && me?.invitedBy) {
    const inviter = await User.findOne({
      where: { id: me.invitedBy, status: 'active', role: MEMBER_ROLE },
      attributes: ['id'],
      include: [{ model: Profile, attributes: ['firstName'], required: false }],
    });
    if (inviter) prefill = await getOrCreateMemberCode(inviter.id);
  }

  return {
    enabled: cfg.enabled && cfg.discountPaise > 0,
    discountPaise: cfg.discountPaise,
    referrerUnlocks: cfg.referrerUnlocks,
    code,
    shareUrl: code ? `${String(config.server.frontendUrl || '').replace(/\/+$/, '')}/signup?ref=${code}` : null,
    stats: {
      signedUp,
      paid: paidRow.n,
      unlocksEarned: paidRow.unlocks,
    },
    eligible: !(await buyerHasPaidBefore(userId)),
    prefill,
  };
};

module.exports = {
  ReferralError,
  normaliseCode,
  getOrCreateMemberCode,
  resolveCode,
  quoteReferral,
  settleReferral,
  buyerHasPaidBefore,
  getReferralSummary,
  MAX_DISCOUNT_SHARE,
};
