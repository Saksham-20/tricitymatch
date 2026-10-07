/**
 * Marketing referral report.
 *
 * One builder behind BOTH portals: the rep reads it for themselves at
 * GET /api/marketing/report, an admin reads the same shape for any rep at
 * GET /api/v1/admin/marketing-users/:userId/report. Keeping it in one place is
 * the point — a rep and an admin looking at the same referral must never see
 * two different stories about who signed up and who paid.
 *
 * A row is one INVITED MEMBER: the lead the referral code created, joined to
 * the account it converted into and that account's paid subscription (if any).
 * "Paid" is deliberately read off the Subscription row rather than the lead's
 * own paymentStatus flag, because the subscription is where money actually
 * lands; the flag is a denormalised copy that a failed write could leave stale.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Profile, Subscription, MarketingLead, ReferralCode } = require('../models');
const { getRateForUser, commissionOn } = require('./marketingCommission');
const { PAID_SUBSCRIPTION_WHERE, PAID_SUBSCRIPTION_SQL, netPaid, money } = require('./paidRevenue');
const { buildLeadWhere } = require('./partnerMembers');

// What counts as money taken lives in utils/paidRevenue.js, shared with every
// admin revenue read: a payment reference and no full refund, whatever the
// row's status (an upgraded-from, cancelled or expired plan was still paid
// for). Commission follows the NET of partial refunds, never the gross.

/**
 * Total collected from the members a rep invited, from Subscriptions. The
 * dashboards used to sum `MarketingLeads.amountPaid`, a denormalised copy that
 * only one activation leg wrote — so they disagreed with this report.
 */
async function getRepRevenue(marketingUserId) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(GREATEST(amount - "refundedAmount", 0)), 0)::float AS total
       FROM "Subscriptions"
      WHERE ${PAID_SUBSCRIPTION_SQL}
        AND "userId" IN (
              SELECT "convertedUserId" FROM "MarketingLeads"
               WHERE "assignedToMarketingUserId" = :marketingUserId AND "convertedUserId" IS NOT NULL)`,
    { replacements: { marketingUserId }, type: sequelize.QueryTypes.SELECT }
  );
  return Number(row?.total) || 0;
}

/**
 * Net revenue from a rep's members split by whether the refund window has
 * passed: `clear` is money paid at least `holdDays` ago (commission on it is
 * payable), `total` is everything. Same predicate and lead join as
 * getRepRevenue, so the two cannot drift. The payment moment is the plan's
 * startDate (activation), falling back to createdAt.
 */
async function getRepRevenueSplit(marketingUserId, holdDays = 7) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(GREATEST(amount - "refundedAmount", 0)), 0)::float AS total,
            COALESCE(SUM(GREATEST(amount - "refundedAmount", 0))
              FILTER (WHERE COALESCE("startDate", "createdAt") <= NOW() - (:holdDays || ' days')::interval), 0)::float AS clear
       FROM "Subscriptions"
      WHERE ${PAID_SUBSCRIPTION_SQL}
        AND "userId" IN (
              SELECT "convertedUserId" FROM "MarketingLeads"
               WHERE "assignedToMarketingUserId" = :marketingUserId AND "convertedUserId" IS NOT NULL)`,
    { replacements: { marketingUserId, holdDays: String(Math.max(0, Math.round(Number(holdDays) || 0))) }, type: sequelize.QueryTypes.SELECT }
  );
  return { total: Number(row?.total) || 0, clear: Number(row?.clear) || 0 };
}

/**
 * @param {string} marketingUserId
 * @param {{ page?: number, limit?: number, status?: string, paymentStatus?: string,
 *           search?: string, signedUp?: 'yes'|'no', paid?: 'yes'|'no', source?: 'code'|'manual',
 *           from?: string, to?: string }} opts  — see utils/partnerMembers buildLeadWhere
 */
async function buildMarketingReport(marketingUserId, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 25, 1), 100);
  const page = Math.max(parseInt(opts.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  // Same filters (search, signed up, paid, source, dates) as the admin's
  // all-partners list; the partner is always this one, whatever the caller sent.
  const filters = buildLeadWhere({ ...opts, marketingUserId: undefined });
  const where = { [Op.and]: [{ assignedToMarketingUserId: marketingUserId }, filters] };

  const { count, rows } = await MarketingLead.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'ConvertedUser',
        required: false,
        attributes: ['id', 'email', 'phone', 'status', 'emailVerified', 'phoneVerified', 'createdAt'],
        include: [
          { model: Profile, required: false, attributes: ['firstName', 'lastName', 'city', 'onboardingComplete'] },
          {
            model: Subscription,
            required: false,
            where: PAID_SUBSCRIPTION_WHERE,
            attributes: ['id', 'planType', 'status', 'amount', 'refundedAmount', 'startDate', 'endDate', 'razorpayPaymentId', 'createdAt'],
          },
        ],
      },
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    // Without this the count is of JOINED rows: a member with two payments
    // counted twice, inflating the total and adding empty pages.
    distinct: true,
    col: 'id',
  });

  const commissionRate = await getRateForUser(marketingUserId);

  const members = rows.map((lead) => {
    const u = lead.ConvertedUser;
    // Every payment the member kept money for: an upgrade leaves the first
    // payment on a superseded (cancelled) row, and it is still money taken.
    const subs = ((u && u.Subscriptions) || []).filter((x) => netPaid(x) > 0);
    // Newest paid subscription is the plan to show; upgrades supersede.
    const sub = subs
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    const memberNet = subs.reduce((sum, x) => sum + netPaid(x), 0);
    const profileName = u && u.Profile
      ? [u.Profile.firstName, u.Profile.lastName].filter(Boolean).join(' ').trim()
      : '';

    return {
      leadId: lead.id,
      // The member's account id, for the admin view to link to (stripped from
      // the partner's own copy of the report).
      memberId: u ? u.id : null,
      name: profileName || lead.name || '—',
      phone: lead.phone,
      email: (u && u.email) || lead.email,
      city: (u && u.Profile && u.Profile.city) || lead.city || null,
      referralCode: lead.referralCode,
      campaign: lead.campaign || null,
      source: lead.source || null,
      leadStatus: lead.status,
      // Did the invite actually become an account?
      signedUp: Boolean(u),
      signedUpAt: u ? u.createdAt : null,
      accountStatus: u ? u.status : null,
      profileComplete: Boolean(u && u.Profile && u.Profile.onboardingComplete),
      // Did that account pay?
      paid: Boolean(sub),
      planType: sub ? sub.planType : null,
      planStatus: sub ? sub.status : null,
      amountPaid: sub ? memberNet : money(lead.paymentStatus === 'paid' ? lead.amountPaid : 0),
      paidAt: sub ? sub.startDate : null,
      planEndsAt: sub ? sub.endDate : null,
      paymentId: sub ? sub.razorpayPaymentId : lead.paymentId || null,
      // Shown per row so the rep can check the total against its parts rather
      // than being handed one number to trust.
      commission: commissionOn(sub ? memberNet : 0, commissionRate),
      createdAt: lead.createdAt,
    };
  });

  // Summary is computed over EVERY lead for this rep, not just the page.
  const [totalLeads, signedUpCount, activeCodes] = await Promise.all([
    MarketingLead.count({ where: { assignedToMarketingUserId: marketingUserId } }),
    MarketingLead.count({
      where: { assignedToMarketingUserId: marketingUserId, convertedUserId: { [Op.ne]: null } },
    }),
    ReferralCode.count({ where: { marketingUserId, isActive: true } }),
  ]);

  const paidRows = await MarketingLead.findAll({
    where: { assignedToMarketingUserId: marketingUserId, convertedUserId: { [Op.ne]: null } },
    attributes: ['convertedUserId'],
    include: [
      {
        model: User,
        as: 'ConvertedUser',
        required: true,
        attributes: ['id'],
        include: [
          {
            model: Subscription,
            required: true,
            where: PAID_SUBSCRIPTION_WHERE,
            attributes: ['amount', 'refundedAmount'],
          },
        ],
      },
    ],
  });

  let paidMembers = 0;
  let revenue = 0;
  paidRows.forEach((lead) => {
    const subs = ((lead.ConvertedUser && lead.ConvertedUser.Subscriptions) || []).filter((x) => netPaid(x) > 0);
    if (!subs.length) return;
    paidMembers += 1;
    subs.forEach((s) => { revenue += netPaid(s); });
  });

  return {
    summary: {
      totalLeads,
      signedUp: signedUpCount,
      paidMembers,
      // Gross paid by members, and the rep's share of it at the current rate.
      revenue,
      commissionRate,
      commissionEarned: commissionOn(revenue, commissionRate),
      activeCodes,
      // Percentages are of the stage above, so they stay meaningful when a lead
      // exists that never became an account.
      signupRate: totalLeads ? Math.round((signedUpCount / totalLeads) * 100) : 0,
      paidRate: signedUpCount ? Math.round((paidMembers / signedUpCount) * 100) : 0,
    },
    members,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { buildMarketingReport, getRepRevenue, getRepRevenueSplit, PAID_SUBSCRIPTION_WHERE };
