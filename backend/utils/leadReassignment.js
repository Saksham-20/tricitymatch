'use strict';

/**
 * Moving leads between marketing partners.
 *
 * Why it is needed: a manual lead only turns into credit while its partner is
 * ACTIVE (utils/manualLeads.findManualLeadForSignup). When a partner leaves or
 * is deactivated, the people they had added silently stop being attributable to
 * anyone. Reassigning them to an active partner puts them back to work.
 *
 * What it will NOT move: a lead that has already become an account
 * (`convertedUserId` set). Commission is derived from exactly that link, so
 * moving one would transfer a member, their payments and the partner's earnings
 * with it — and the Partner Guide promises credit "does not move afterwards".
 * Those stay where they are, always.
 *
 * Duplicates are skipped, not overwritten: a partner already holding the same
 * phone or email keeps their own record.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { MarketingLead, User } = require('../models');

const PARTNER_ROLES = ['marketing', 'marketing_manager'];
const OPEN_STATUSES = ['new', 'contacted'];

class LeadReassignError extends Error {
  constructor(message, status = 400) { super(message); this.statusCode = status; }
}

const meaningful = (v) => (v && v !== 'N/A' ? String(v).toLowerCase() : null);

/** Leads a partner still has open and could hand over (never a converted one). */
const countOpenLeads = async (partnerIds) => {
  const ids = Array.isArray(partnerIds) ? partnerIds : [partnerIds];
  if (!ids.length) return {};
  const rows = await MarketingLead.findAll({
    attributes: ['assignedToMarketingUserId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    where: { assignedToMarketingUserId: { [Op.in]: ids }, convertedUserId: null, status: { [Op.in]: OPEN_STATUSES } },
    group: ['assignedToMarketingUserId'],
    raw: true,
  });
  return Object.fromEntries(rows.map((r) => [r.assignedToMarketingUserId, Number(r.n)]));
};

/**
 * @param {object} o
 * @param {string} o.toUserId     active partner receiving the leads
 * @param {string[]} [o.leadIds]  specific leads, OR
 * @param {string} [o.fromUserId] every OPEN lead of this partner
 * @returns {Promise<{moved:number, skippedConverted:number, skippedDuplicate:number, skippedSame:number, requested:number}>}
 */
const reassignLeads = async ({ toUserId, leadIds, fromUserId }) => {
  if (!toUserId) throw new LeadReassignError('Choose the partner to move the leads to');
  if (!leadIds?.length && !fromUserId) throw new LeadReassignError('Say which leads to move');
  if (leadIds && leadIds.length > 500) throw new LeadReassignError('Move at most 500 leads at a time');

  return sequelize.transaction(async (t) => {
    const target = await User.findByPk(toUserId, { attributes: ['id', 'role', 'status'], transaction: t });
    if (!target || !PARTNER_ROLES.includes(target.role)) throw new LeadReassignError('That account is not a marketing partner', 404);
    if (target.status !== 'active') throw new LeadReassignError('That partner is not active, so leads moved to them would earn nothing');

    const where = leadIds?.length
      ? { id: { [Op.in]: leadIds } }
      : { assignedToMarketingUserId: fromUserId, status: { [Op.in]: OPEN_STATUSES } };
    const selected = await MarketingLead.findAll({ where, transaction: t, lock: t.LOCK.UPDATE });

    const out = { requested: selected.length, moved: 0, skippedConverted: 0, skippedDuplicate: 0, skippedSame: 0 };

    const theirs = await MarketingLead.findAll({
      where: { assignedToMarketingUserId: toUserId },
      attributes: ['phone', 'email'],
      transaction: t,
    });
    const havePhone = new Set(theirs.map((l) => meaningful(l.phone)).filter(Boolean));
    const haveEmail = new Set(theirs.map((l) => meaningful(l.email)).filter(Boolean));

    const movable = [];
    for (const lead of selected) {
      if (lead.convertedUserId) { out.skippedConverted += 1; continue; }
      if (lead.assignedToMarketingUserId === toUserId) { out.skippedSame += 1; continue; }
      const p = meaningful(lead.phone);
      const e = meaningful(lead.email);
      if ((p && havePhone.has(p)) || (e && haveEmail.has(e))) { out.skippedDuplicate += 1; continue; }
      // Two leads in this same batch with one phone must not both land on the target.
      if (p) havePhone.add(p);
      if (e) haveEmail.add(e);
      movable.push(lead.id);
    }

    if (movable.length) {
      await MarketingLead.update({ assignedToMarketingUserId: toUserId }, { where: { id: { [Op.in]: movable } }, transaction: t });
    }
    out.moved = movable.length;
    out.movedIds = movable;
    return out;
  });
};

module.exports = { reassignLeads, countOpenLeads, LeadReassignError, OPEN_STATUSES, PARTNER_ROLES };
