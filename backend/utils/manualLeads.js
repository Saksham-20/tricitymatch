'use strict';

/**
 * Leads a marketing partner adds by hand (people they already know, before
 * those people have signed up).
 *
 * Attribution: when such a person later creates an account WITHOUT typing a
 * code, the signup is credited to the partner whose unconverted lead matches
 * the proved phone or email — earliest lead wins (first touch), the partner
 * must still be active, and the lead must be younger than ATTRIBUTION_DAYS so
 * a stale list cannot claim people indefinitely.
 *
 * Privacy: adding a lead never reveals whether that phone or email already
 * belongs to a member. Membership of a matrimonial site is sensitive, and a
 * partner probing numbers would otherwise learn it. A duplicate is only
 * rejected within the partner's OWN list.
 */

const { Op } = require('sequelize');
const { createError } = require('../middlewares/errorHandler');
const { normalizePhone } = require('./smsService');
const { canonicalEmail } = require('./emailAddress');

const ATTRIBUTION_DAYS = 60;
const MANUAL_LEADS_CAP = 300;
const SOURCE = 'manual';

const normalisePhoneStrict = (raw) => {
  const p = normalizePhone(raw);
  return p && /^91\d{10}$/.test(p) ? p : null;
};

const createManualLead = async ({ marketingUserId, name, phone, email, city }) => {
  const { MarketingLead } = require('../models');
  const cleanName = String(name || '').trim();
  if (cleanName.length < 2) throw createError.badRequest('Enter the person\'s name');
  const phoneNorm = normalisePhoneStrict(phone);
  if (!phoneNorm) throw createError.badRequest('Enter a valid 10-digit Indian mobile number');
  const emailNorm = email ? canonicalEmail(email) : null;
  if (email && !emailNorm) throw createError.badRequest('Enter a valid email address');

  const owned = await MarketingLead.count({
    where: { assignedToMarketingUserId: marketingUserId, source: SOURCE },
  });
  if (owned >= MANUAL_LEADS_CAP) {
    throw createError.badRequest(`You can keep up to ${MANUAL_LEADS_CAP} added leads. Mark old ones as lost to add more.`);
  }

  const dupWhere = emailNorm ? { [Op.or]: [{ phone: phoneNorm }, { email: emailNorm }] } : { phone: phoneNorm };
  const dup = await MarketingLead.findOne({
    where: { assignedToMarketingUserId: marketingUserId, ...dupWhere },
    attributes: ['id'],
  });
  if (dup) throw createError.conflict('This person is already in your list');

  return MarketingLead.create({
    name: cleanName,
    phone: phoneNorm,
    email: emailNorm || 'N/A',
    city: city ? String(city).trim() : null,
    source: SOURCE,
    assignedToMarketingUserId: marketingUserId,
    status: 'new',
  });
};

/** The lead a fresh signup should convert, or null. */
const findManualLeadForSignup = async ({ phone, email }) => {
  const { MarketingLead, User } = require('../models');
  const phoneNorm = phone ? normalisePhoneStrict(phone) : null;
  const emailNorm = email ? canonicalEmail(email) : null;
  if (!phoneNorm && !emailNorm) return null;

  const ors = [];
  if (phoneNorm) ors.push({ phone: phoneNorm });
  if (emailNorm) ors.push({ email: emailNorm });

  const since = new Date(Date.now() - ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await MarketingLead.findAll({
    where: {
      source: SOURCE,
      convertedUserId: null,
      createdAt: { [Op.gte]: since },
      [Op.or]: ors,
    },
    include: [{ model: User, as: 'AssignedMarketer', attributes: ['id', 'status'], required: true, where: { status: 'active' } }],
    order: [['createdAt', 'ASC']],
    limit: 1,
  });
  return candidates[0] || null;
};

module.exports = {
  ATTRIBUTION_DAYS,
  MANUAL_LEADS_CAP,
  SOURCE,
  createManualLead,
  findManualLeadForSignup,
};
