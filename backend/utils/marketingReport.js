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
const { User, Profile, Subscription, MarketingLead, ReferralCode } = require('../models');

// A subscription only counts as revenue when a payment reference exists. An
// admin grant is written with the plan's list price and no payment id, so
// summing on amount alone would report comped plans as money taken. The column
// also carries the Google Play purchase token, so store purchases still count.
const PAID_SUBSCRIPTION_WHERE = {
  status: { [Op.in]: ['active', 'expired'] },
  razorpayPaymentId: { [Op.ne]: null },
};

const money = (v) => (v == null ? 0 : Number(v));

/**
 * @param {string} marketingUserId
 * @param {{ page?: number, limit?: number, status?: string, paymentStatus?: string }} opts
 */
async function buildMarketingReport(marketingUserId, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 25, 1), 100);
  const page = Math.max(parseInt(opts.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const where = { assignedToMarketingUserId: marketingUserId };
  if (['new', 'contacted', 'converted', 'lost'].includes(opts.status)) where.status = opts.status;
  if (['none', 'paid'].includes(opts.paymentStatus)) where.paymentStatus = opts.paymentStatus;

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
            attributes: ['id', 'planType', 'status', 'amount', 'startDate', 'endDate', 'razorpayPaymentId', 'createdAt'],
          },
        ],
      },
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });

  const members = rows.map((lead) => {
    const u = lead.ConvertedUser;
    const subs = (u && u.Subscriptions) || [];
    // Newest paid subscription is the one to show; upgrades supersede.
    const sub = subs
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    const profileName = u && u.Profile
      ? [u.Profile.firstName, u.Profile.lastName].filter(Boolean).join(' ').trim()
      : '';

    return {
      leadId: lead.id,
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
      amountPaid: sub ? money(sub.amount) : money(lead.paymentStatus === 'paid' ? lead.amountPaid : 0),
      paidAt: sub ? sub.startDate : null,
      planEndsAt: sub ? sub.endDate : null,
      paymentId: sub ? sub.razorpayPaymentId : lead.paymentId || null,
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
            attributes: ['amount'],
          },
        ],
      },
    ],
  });

  let paidMembers = 0;
  let revenue = 0;
  paidRows.forEach((lead) => {
    const subs = (lead.ConvertedUser && lead.ConvertedUser.Subscriptions) || [];
    if (!subs.length) return;
    paidMembers += 1;
    subs.forEach((s) => { revenue += money(s.amount); });
  });

  return {
    summary: {
      totalLeads,
      signedUp: signedUpCount,
      paidMembers,
      revenue,
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

module.exports = { buildMarketingReport, PAID_SUBSCRIPTION_WHERE };
