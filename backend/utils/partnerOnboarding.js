'use strict';

/**
 * Where a marketing partner stands in getting set up, and the one record that
 * matters legally: that they accepted the Partner Guide.
 *
 * The guide says it "forms part of your agreement", which is only true if an
 * acceptance exists. It is stored next to the member-terms consent on
 * Users.consent (`consent.partnerAgreement`) with the version, time, IP and user
 * agent, written as an atomic jsonb_set so a concurrent write to another consent
 * field cannot erase it.
 *
 * Accepting is a precondition for the two actions that put the brand and other
 * people's contact details in a partner's hands: generating a referral code and
 * adding a lead. Everything else (viewing the dashboard, saving payout details,
 * reading the guide) stays open so a new partner can look around first.
 */

const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { createError } = require('../middlewares/errorHandler');
const { PARTNER_GUIDE_VERSION } = require('../constants/partnerProgramme');

const PARTNER_ROLES = ['marketing', 'marketing_manager'];

const STEP_KEYS = ['agreement', 'payout', 'code', 'outreach'];

/** Counts and flags for a set of users, in one round trip. */
const fetchRaw = (ids) => sequelize.query(
  `SELECT u.id,
          u.consent #>> '{partnerAgreement,version}'    AS "agreementVersion",
          u.consent #>> '{partnerAgreement,acceptedAt}' AS "agreementAcceptedAt",
          EXISTS (SELECT 1 FROM "MarketingPayoutDetails" d WHERE d."marketingUserId" = u.id) AS "hasPayout",
          (SELECT COUNT(*)::int FROM "ReferralCodes" r WHERE r."marketingUserId" = u.id)      AS codes,
          (SELECT COUNT(*)::int FROM "MarketingLeads" l WHERE l."assignedToMarketingUserId" = u.id) AS leads
     FROM "Users" u
    WHERE u.id IN (:ids)`,
  { replacements: { ids }, type: QueryTypes.SELECT },
);

const shape = (row) => {
  const accepted = row.agreementVersion === PARTNER_GUIDE_VERSION;
  const steps = {
    agreement: accepted,
    payout: Boolean(row.hasPayout),
    code: row.codes > 0,
    outreach: row.leads > 0,
  };
  const completed = STEP_KEYS.filter((k) => steps[k]).length;
  return {
    guideVersion: PARTNER_GUIDE_VERSION,
    agreementAcceptedAt: accepted ? row.agreementAcceptedAt : null,
    // An older acceptance exists but the guide has changed since.
    needsReacceptance: Boolean(row.agreementVersion) && !accepted,
    steps,
    completed,
    total: STEP_KEYS.length,
    complete: completed === STEP_KEYS.length,
  };
};

/** Onboarding status for one partner. */
const getOnboarding = async (userId) => {
  const [row] = await fetchRaw([userId]);
  if (!row) throw createError.notFound('Account not found');
  return shape(row);
};

/** `{ [userId]: status }` for the admin list, without an N+1. */
const getOnboardingBatch = async (userIds) => {
  if (!userIds.length) return {};
  const rows = await fetchRaw(userIds);
  return Object.fromEntries(rows.map((r) => [r.id, shape(r)]));
};

/** Store the acceptance of the CURRENT guide version. */
const recordAgreement = async (userId, req = {}) => {
  const now = new Date().toISOString();
  const record = {
    version: PARTNER_GUIDE_VERSION,
    acceptedAt: now,
    ip: req.ip || null,
    userAgent: String(req.get?.('user-agent') || '').slice(0, 200) || null,
  };
  await sequelize.query(
    `UPDATE "Users"
        SET consent = jsonb_set(
              COALESCE(consent, '{}'::jsonb),
              '{partnerAgreement}',
              (COALESCE(consent #> '{partnerAgreement}', '{}'::jsonb)
                 || jsonb_build_object('history',
                      COALESCE(consent #> '{partnerAgreement,history}', '[]'::jsonb)
                      || CASE WHEN consent #>> '{partnerAgreement,version}' IS NOT NULL
                              THEN jsonb_build_array(jsonb_build_object(
                                     'version', consent #>> '{partnerAgreement,version}',
                                     'acceptedAt', consent #>> '{partnerAgreement,acceptedAt}'))
                              ELSE '[]'::jsonb END))
              || :record::jsonb,
              true),
            "updatedAt" = NOW()
      WHERE id = :id`,
    { replacements: { id: userId, record: JSON.stringify(record) } },
  );
  return record;
};

/**
 * Route guard: a partner must have accepted the current guide. Admin and
 * super_admin pass (they run the programme, they are not bound by it), and the
 * gate is a no-op for any non-partner role so it can sit on shared routes.
 */
const requirePartnerAgreement = async (req, res, next) => {
  try {
    if (!req.user || !PARTNER_ROLES.includes(req.user.role)) return next();
    const [row] = await fetchRaw([req.user.id]);
    if (row && row.agreementVersion === PARTNER_GUIDE_VERSION) return next();
    return next(createError.forbidden(
      'Please read and accept the Partner Guide before you start. You can do that from the Partner Guide page.',
      'PARTNER_AGREEMENT_REQUIRED',
    ));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  PARTNER_ROLES,
  STEP_KEYS,
  getOnboarding,
  getOnboardingBatch,
  recordAgreement,
  requirePartnerAgreement,
};
