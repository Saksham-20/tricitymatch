'use strict';

/**
 * Who is under which partner — the filter, search and enrichment behind every
 * list of a partner's leads and members.
 *
 * A MarketingLead is the one record tying a person to a partner: created by a
 * referral code at signup or checkout, or by the partner adding someone by
 * hand; `convertedUserId` is set once that person has an account. So "the
 * members under a partner" is that partner's leads with an account, and the
 * same filters serve the admin's all-partners view, the admin's view of one
 * partner and the partner's own report — one definition, so the three can
 * never disagree about who counts.
 *
 * "Paid" is read off Subscriptions (utils/paidRevenue), never the lead's
 * `paymentStatus` flag: that flag is a denormalised copy only one activation
 * leg wrote, so filtering on it hid members who had in fact paid.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Profile, Subscription } = require('../models');
const { PAID_SUBSCRIPTION_SQL, PAID_SUBSCRIPTION_WHERE, netPaid } = require('./paidRevenue');

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

// Members who have kept money with us. Same predicate as every revenue read.
const PAID_MEMBER_IDS_SQL = `SELECT "userId" FROM "Subscriptions"
  WHERE ${PAID_SUBSCRIPTION_SQL}
  GROUP BY "userId"
  HAVING SUM(GREATEST(amount - "refundedAmount", 0)) > 0`;

const likeTerm = (raw) => `%${String(raw).replace(/[%_\\]/g, '\\$&')}%`;

// A date filter means whole days as people in India read them: "to 11 Oct"
// includes the evening of the 11th even though that is the 11th in UTC too,
// and "from 11 Oct" does not start at 05:30 IST.
const istDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:30`);
const istDayEnd = (ymd) => new Date(istDayStart(ymd).getTime() + 24 * 60 * 60 * 1000);

/**
 * Sequelize `where` for MarketingLeads from query-string style options.
 * Unknown or malformed values are ignored rather than rejected, the way the
 * other admin list filters behave.
 */
function buildLeadWhere(opts = {}) {
  const and = [];

  if (opts.marketingUserId && UUID_RE.test(String(opts.marketingUserId))) {
    and.push({ assignedToMarketingUserId: opts.marketingUserId });
  }
  if (LEAD_STATUSES.includes(opts.status)) and.push({ status: opts.status });
  // Legacy flag filter, kept for old clients; `paid` is the accurate one.
  if (['none', 'paid'].includes(opts.paymentStatus)) and.push({ paymentStatus: opts.paymentStatus });

  if (opts.signedUp === 'yes') and.push({ convertedUserId: { [Op.ne]: null } });
  if (opts.signedUp === 'no') and.push({ convertedUserId: null });

  if (opts.paid === 'yes') {
    and.push(sequelize.literal(`"MarketingLead"."convertedUserId" IN (${PAID_MEMBER_IDS_SQL})`));
  }
  if (opts.paid === 'no') {
    and.push(sequelize.literal(`("MarketingLead"."convertedUserId" IS NULL OR "MarketingLead"."convertedUserId" NOT IN (${PAID_MEMBER_IDS_SQL}))`));
  }

  // How the person reached the partner: a referral code, or added by hand.
  if (opts.source === 'code') and.push({ referralCode: { [Op.ne]: null } });
  if (opts.source === 'manual') and.push({ referralCode: null });

  if (typeof opts.referralCode === 'string' && opts.referralCode.trim()) {
    and.push({ referralCode: opts.referralCode.trim().toUpperCase() });
  }

  if (YMD_RE.test(opts.from || '')) and.push({ createdAt: { [Op.gte]: istDayStart(opts.from) } });
  if (YMD_RE.test(opts.to || '')) and.push({ createdAt: { [Op.lt]: istDayEnd(opts.to) } });

  const q = typeof opts.search === 'string' ? opts.search.trim().slice(0, 100) : '';
  if (q) {
    const term = likeTerm(q);
    const or = [
      { name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      { city: { [Op.iLike]: term } },
      { referralCode: { [Op.iLike]: term } },
      { campaign: { [Op.iLike]: term } },
    ];
    // A phone typed with spaces or +91 still finds the stored digits.
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 4 && digits !== q) or.push({ phone: { [Op.iLike]: `%${digits.slice(-10)}%` } });
    // ...and the member's own account: the name on the profile and the email
    // they signed up with can differ from what the partner typed on the lead.
    const escaped = sequelize.escape(term);
    or.push(sequelize.literal(`"MarketingLead"."convertedUserId" IN (
      SELECT u.id FROM "Users" u LEFT JOIN "Profiles" p ON p."userId" = u.id
       WHERE u.email ILIKE ${escaped}
          OR u.phone ILIKE ${escaped}
          OR TRIM(COALESCE(p."firstName", '') || ' ' || COALESCE(p."lastName", '')) ILIKE ${escaped})`));
    and.push({ [Op.or]: or });
  }

  return and.length ? { [Op.and]: and } : {};
}

/** The counts an admin reads above a filtered list: how many, signed up, paid. */
async function summariseLeads(MarketingLead, where) {
  const [total, signedUp, paid] = await Promise.all([
    MarketingLead.count({ where }),
    MarketingLead.count({ where: { [Op.and]: [where, { convertedUserId: { [Op.ne]: null } }] } }),
    MarketingLead.count({
      where: { [Op.and]: [where, sequelize.literal(`"MarketingLead"."convertedUserId" IN (${PAID_MEMBER_IDS_SQL})`)] },
    }),
  ]);
  return { total, signedUp, paid };
}

/**
 * What became of each lead's account, for a page of leads: the member's name,
 * account state, current paid plan and what they have paid in total. One query
 * for the whole page.
 */
async function memberFacts(leads) {
  const ids = [...new Set(leads.map((l) => l.convertedUserId).filter(Boolean))];
  if (!ids.length) return {};
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ['id', 'email', 'phone', 'status', 'createdAt'],
    include: [
      { model: Profile, required: false, attributes: ['firstName', 'lastName', 'city', 'onboardingComplete'] },
      {
        model: Subscription,
        required: false,
        where: PAID_SUBSCRIPTION_WHERE,
        attributes: ['planType', 'status', 'amount', 'refundedAmount', 'startDate', 'endDate', 'createdAt'],
      },
    ],
  });
  const out = {};
  users.forEach((u) => {
    const subs = (u.Subscriptions || []).filter((s) => netPaid(s) > 0);
    const latest = subs.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    out[u.id] = {
      id: u.id,
      name: [u.Profile?.firstName, u.Profile?.lastName].filter(Boolean).join(' ').trim() || null,
      email: u.email,
      phone: u.phone,
      city: u.Profile?.city || null,
      status: u.status,
      profileComplete: Boolean(u.Profile?.onboardingComplete),
      signedUpAt: u.createdAt,
      paid: Boolean(latest),
      amountPaid: subs.reduce((sum, s) => sum + netPaid(s), 0),
      planType: latest ? latest.planType : null,
      planStatus: latest ? latest.status : null,
      paidAt: latest ? latest.startDate : null,
      planEndsAt: latest ? latest.endDate : null,
    };
  });
  return out;
}

const partnerName = (u) => (u
  ? [u.Profile?.firstName, u.Profile?.lastName].filter(Boolean).join(' ').trim() || u.email
  : null);

module.exports = {
  buildLeadWhere,
  summariseLeads,
  memberFacts,
  partnerName,
  PAID_MEMBER_IDS_SQL,
  LEAD_STATUSES,
};
