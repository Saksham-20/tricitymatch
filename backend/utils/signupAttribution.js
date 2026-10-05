'use strict';

/**
 * Who gets credit for a new account: a partner's referral code, a member's
 * referral code or invite link, or a partner who added the person as a lead by
 * hand. One implementation for every way an account is created (email or phone
 * signup, Google), so the path a person picks never changes who is credited or
 * what they receive.
 *
 * Three steps, matching where each must run:
 *   resolveSignupAttribution  before the signup transaction (reads only)
 *   recordSignupAttribution   inside it (writes that must commit with the user)
 *   afterSignupAttribution    after it (rewards, which never cost an account)
 */

const { User, ReferralCode, MarketingLead } = require('../models');
const { log } = require('../middlewares/logger');
const { trackEvent } = require('./trackEvent');
const { MEMBER_ROLE } = require('./memberRole');

const BOOST_MS = 48 * 60 * 60 * 1000;

/**
 * @param {object} p
 * @param {string} [p.code]    referral code typed or carried on the link (?ref=)
 * @param {string} [p.invite]  member invite token (?invite=)
 * @param {string} [p.phone]   the account's proved phone, if any
 * @param {string} [p.email]   the account's proved email, if any
 * @returns {Promise<{referralData: object|null, invitedBy: string|null, manualLead: object|null}>}
 */
async function resolveSignupAttribution({ code, invite, phone = null, email = null } = {}) {
  let referralData = null;
  let invitedBy = null;
  let manualLead = null;

  if (code && typeof code === 'string') {
    const row = await ReferralCode.findOne({ where: { code: code.trim().toUpperCase(), isActive: true } });
    // Same rule as checkout (utils/referral.js resolveCode): a code whose rep
    // has been deactivated must not keep creating leads and boosting members.
    const rep = row ? await User.findByPk(row.marketingUserId, { attributes: ['id', 'status'] }) : null;
    if (row && rep && rep.status === 'active') {
      referralData = {
        referralCodeUsed: row.code,
        referredByMarketingUserId: row.marketingUserId,
        isBoosted: true,
        boostExpiresAt: new Date(Date.now() + BOOST_MS),
      };
    }
  }

  // A MEMBER's referral code typed in the same box as a partner code. Partner
  // codes resolve first; only when none matched do we look for a member, and it
  // then behaves exactly like that member's invite link.
  if (code && !referralData) {
    try {
      const { normaliseCode } = require('./referral');
      const memberCode = normaliseCode(String(code));
      if (memberCode) {
        // A staff account's code (if one was ever minted) credits nobody.
        const referrer = await User.findOne({ where: { referralCode: memberCode, status: 'active', role: MEMBER_ROLE }, attributes: ['id'] });
        if (referrer) invitedBy = referrer.id;
      }
    } catch (err) {
      log.warn('Member referral lookup failed at signup (ignored)', { error: err.message });
    }
  }

  // No code: a partner who added this person as a lead by hand still gets the
  // attribution (first touch, recent lead, active partner). No boost — that is
  // the code's reward for a member who chose to use it.
  if (!referralData) {
    try {
      const { findManualLeadForSignup } = require('./manualLeads');
      manualLead = await findManualLeadForSignup({ phone, email });
      if (manualLead) {
        referralData = {
          referralCodeUsed: null,
          referredByMarketingUserId: manualLead.assignedToMarketingUserId,
          isBoosted: false,
          boostExpiresAt: null,
        };
      }
    } catch (err) {
      log.warn('Manual lead lookup failed at signup (ignored)', { error: err.message });
    }
  }

  // Resolved at signup, not just when the landing page rendered the inviter's
  // name: the inviter may have gone inactive since. A forged or stale token is
  // silently ignored, never an error.
  if (invite && !invitedBy) {
    try {
      const token = String(invite).trim();
      if (/^[0-9a-f]{16,128}$/i.test(token)) {
        const inviter = await User.findOne({ where: { inviteToken: token, status: 'active', role: MEMBER_ROLE }, attributes: ['id'] });
        if (inviter) invitedBy = inviter.id;
      }
    } catch (err) {
      log.warn('Invite lookup failed at signup (ignored)', { error: err.message });
    }
  }

  return { referralData, invitedBy, manualLead };
}

/** The User columns the attribution sets at creation. */
const attributionUserFields = ({ referralData, invitedBy } = {}) => ({
  invitedBy: invitedBy || null,
  ...(referralData || {}),
});

/**
 * Inside the signup transaction: convert a hand-added lead, or count the code
 * use and open a lead for the partner.
 */
async function recordSignupAttribution(t, user, { referralData, manualLead } = {}, { name, phone, email } = {}) {
  const sequelize = require('../config/database');
  if (manualLead) {
    // `convertedUserId IS NULL` guard: two near-simultaneous signups matching
    // the same lead cannot both convert it.
    await MarketingLead.update(
      { convertedUserId: user.id, status: 'contacted' },
      { where: { id: manualLead.id, convertedUserId: null }, transaction: t },
    );
  } else if (referralData) {
    // Quoted column: an unquoted `usageCount + 1` folds to `usagecount` in
    // Postgres and threw inside the signup transaction.
    await ReferralCode.update(
      { usageCount: sequelize.literal('"usageCount" + 1') },
      { where: { code: referralData.referralCodeUsed }, transaction: t },
    );
    await MarketingLead.create({
      name: (name || '').trim() || 'New member',
      phone: phone || 'N/A',
      email: email || 'N/A',
      assignedToMarketingUserId: referralData.referredByMarketingUserId,
      referralCode: referralData.referralCodeUsed,
      convertedUserId: user.id,
      status: 'contacted',
    }, { transaction: t });
  }
}

/** After commit: invite rewards for both sides. Never throws. */
async function afterSignupAttribution(userId, { invitedBy } = {}) {
  if (!invitedBy) return;
  trackEvent(userId, 'invited_signup');
  await require('./inviteReward').rewardInvite(userId, invitedBy);
}

module.exports = {
  resolveSignupAttribution,
  attributionUserFields,
  recordSignupAttribution,
  afterSignupAttribution,
};
