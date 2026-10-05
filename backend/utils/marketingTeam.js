'use strict';

/**
 * The team view for a marketing manager: every partner's numbers side by side.
 *
 * Numbers only. A manager is shown how each partner is doing (leads, sign-ups,
 * paying members, revenue, the commission it earns) but never the members
 * themselves (names, phones, emails) and never payout details or what has been
 * paid out. Individual member rows and money movements stay with the partner
 * and the admins who run payouts.
 *
 * Revenue and commission use the same definition of "money taken" as every
 * other report (utils/paidRevenue): a payment reference, no full refund, net of
 * partial refunds. Computed in two grouped queries rather than one report per
 * partner, so the page costs the same for 5 partners or 200.
 */

const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { User, Profile, ReferralCode } = require('../models');
const { getRateForUser, commissionOn } = require('./marketingCommission');
const { PAID_SUBSCRIPTION_SQL } = require('./paidRevenue');
const { getOnboardingBatch } = require('./partnerOnboarding');
const { countOpenLeads } = require('./leadReassignment');

const PARTNER_ROLES = ['marketing', 'marketing_manager'];
const MAX_PARTNERS = 500;

async function getTeamOverview() {
  const partners = await User.findAll({
    where: { role: { [Op.in]: PARTNER_ROLES } },
    attributes: ['id', 'email', 'role', 'status', 'createdAt'],
    include: [{ model: Profile, attributes: ['firstName', 'lastName'], required: false }],
    order: [['createdAt', 'DESC']],
    limit: MAX_PARTNERS + 1,
  });
  const truncated = partners.length > MAX_PARTNERS;
  const list = partners.slice(0, MAX_PARTNERS);
  const ids = list.map((p) => p.id);
  if (!ids.length) return { partners: [], totals: emptyTotals(), truncated: false, generatedAt: new Date().toISOString() };

  const [leadRows, paidRows, codeRows, onboarding, openLeads] = await Promise.all([
    sequelize.query(
      `SELECT "assignedToMarketingUserId" AS id,
              COUNT(*)::int AS "totalLeads",
              COUNT("convertedUserId")::int AS "signedUp"
         FROM "MarketingLeads"
        WHERE "assignedToMarketingUserId" IN (:ids)
        GROUP BY "assignedToMarketingUserId"`,
      { replacements: { ids }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT l."assignedToMarketingUserId" AS id,
              COUNT(*)::int AS "paidMembers",
              COALESCE(SUM(m.net), 0)::float AS revenue
         FROM "MarketingLeads" l
         JOIN (SELECT "userId", SUM(GREATEST(amount - "refundedAmount", 0)) AS net
                 FROM "Subscriptions"
                WHERE ${PAID_SUBSCRIPTION_SQL}
                GROUP BY "userId"
               HAVING SUM(GREATEST(amount - "refundedAmount", 0)) > 0) m
           ON m."userId" = l."convertedUserId"
        WHERE l."assignedToMarketingUserId" IN (:ids)
          AND l."convertedUserId" IS NOT NULL
        GROUP BY l."assignedToMarketingUserId"`,
      { replacements: { ids }, type: QueryTypes.SELECT }
    ),
    ReferralCode.findAll({
      attributes: ['marketingUserId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      where: { marketingUserId: { [Op.in]: ids }, isActive: true },
      group: ['marketingUserId'],
      raw: true,
    }),
    getOnboardingBatch(ids),
    countOpenLeads(ids),
  ]);

  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id || r.marketingUserId, r]));
  const leads = byId(leadRows);
  const paid = byId(paidRows);
  const codes = byId(codeRows);

  const rows = [];
  for (const p of list) {
    const l = leads[p.id] || {};
    const pd = paid[p.id] || {};
    const revenue = Number(pd.revenue) || 0;
    const rate = await getRateForUser(p.id); // eslint-disable-line no-await-in-loop
    const ob = onboarding[p.id];
    rows.push({
      id: p.id,
      name: [p.Profile?.firstName, p.Profile?.lastName].filter(Boolean).join(' ').trim() || p.email,
      email: p.email,
      role: p.role,
      status: p.status,
      joinedAt: p.createdAt,
      totalLeads: Number(l.totalLeads) || 0,
      signedUp: Number(l.signedUp) || 0,
      paidMembers: Number(pd.paidMembers) || 0,
      revenue,
      commissionRate: rate,
      commissionEarned: commissionOn(revenue, rate),
      activeCodes: Number(codes[p.id]?.n) || 0,
      openLeads: openLeads[p.id] || 0,
      setup: ob ? { completed: ob.completed, total: ob.total } : null,
    });
  }
  rows.sort((a, b) => (b.revenue - a.revenue) || (b.signedUp - a.signedUp) || (new Date(b.joinedAt) - new Date(a.joinedAt)));

  const totals = rows.reduce((t, r) => ({
    partners: t.partners + 1,
    activePartners: t.activePartners + (r.status === 'active' ? 1 : 0),
    totalLeads: t.totalLeads + r.totalLeads,
    signedUp: t.signedUp + r.signedUp,
    paidMembers: t.paidMembers + r.paidMembers,
    revenue: t.revenue + r.revenue,
    commissionEarned: t.commissionEarned + r.commissionEarned,
    openLeads: t.openLeads + r.openLeads,
  }), emptyTotals());

  return { partners: rows, totals, truncated, generatedAt: new Date().toISOString() };
}

function emptyTotals() {
  return { partners: 0, activePartners: 0, totalLeads: 0, signedUp: 0, paidMembers: 0, revenue: 0, commissionEarned: 0, openLeads: 0 };
}

module.exports = { getTeamOverview, PARTNER_ROLES };
