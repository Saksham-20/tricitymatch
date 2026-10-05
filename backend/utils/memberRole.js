'use strict';

/**
 * Who counts as a MEMBER on the member-facing side.
 *
 * Staff accounts (admin, super_admin, sub_admin, marketing, marketing_manager)
 * are Users too. Every one of them has a Profile row with placeholder identity
 * (gender 'other', DOB 1990), they can browse the member site, and some carry
 * Match / ProfileView / Message / GroupMember rows from before staff were
 * stopped from interacting. None of that may surface to a member: a staff
 * account is not a prospective match, so it must not appear in a relationship
 * list, be reachable by profile id, count as a mutual match for chat or calls,
 * or resolve as the owner of an invite or referral code.
 *
 * Applied at READ time; nothing here deletes the historical rows.
 *
 * This is role ONLY. An admin's "quiet hide" (Users.hiddenAt) is deliberately
 * NOT applied here: a hidden member stays visible to the people they already
 * contacted. Discovery listings apply both through profileVisibility's
 * STAFF_EXCLUDED.
 *
 * Kept in its own module (no dependency on entitlements) so utils/entitlements
 * can use it without a require cycle; profileVisibility re-exports everything.
 */

const { Op, literal } = require('sequelize');
const { User } = require('../models');

const MEMBER_ROLE = 'user';

// For an include on User. Spread or pass as-is; never mutate it.
const ACTIVE_MEMBER_WHERE = { status: 'active', role: MEMBER_ROLE };

// Subqueries for an id column that is not joined to Users.
const STAFF_USERS_SQL = `(SELECT id FROM "Users" WHERE role <> '${MEMBER_ROLE}')`;
const ACTIVE_MEMBERS_SQL = `(SELECT id FROM "Users" WHERE status = 'active' AND role = '${MEMBER_ROLE}')`;

/** `{ [Op.notIn]: staff ids }` for a user-id column. */
const notStaffId = () => ({ [Op.notIn]: literal(STAFF_USERS_SQL) });

/** A loaded User (needs `role`) is a member, not a staff account. */
const isMember = (user) => Boolean(user) && user.role === MEMBER_ROLE;

/**
 * Both ids belong to member accounts. A mutual match, a chat thread or a call
 * between a member and a staff account does not count, whatever the Match row
 * says. One indexed primary-key query.
 */
const bothMembers = async (userIdA, userIdB, { transaction } = {}) => {
  if (!userIdA || !userIdB || userIdA === userIdB) return false;
  const n = await User.count({
    where: { id: { [Op.in]: [userIdA, userIdB] }, role: MEMBER_ROLE },
    ...(transaction ? { transaction } : {}),
  });
  return n === 2;
};

module.exports = {
  MEMBER_ROLE,
  ACTIVE_MEMBER_WHERE,
  STAFF_USERS_SQL,
  ACTIVE_MEMBERS_SQL,
  notStaffId,
  isMember,
  bothMembers,
};
