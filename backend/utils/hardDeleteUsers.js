/**
 * Admin hard delete: removes the Users row and everything hanging off it.
 *
 * Distinct from utils/accountErasure (member self-delete, anonymise-in-place).
 * An admin clearing test/spam accounts wants the rows GONE.
 *
 * The live database has ON DELETE NO ACTION on five FKs into Users
 * (Groups.createdBy, Groups.candidateUserId, GroupMembers.userId,
 * GroupMessages.senderId, UnlockPurchases.userId) even though the migrations say
 * CASCADE, so a bare DELETE fails for anyone who touched a family group or
 * bought an unlock. Those are cleared explicitly first; everything else
 * cascades or nulls at the DB level.
 *
 * Refused (returned in `blocked`, never thrown, so a bulk call reports per-row):
 *   - any role other than 'user' (admins / sub-admins / marketing staff)
 *   - the acting admin
 *   - accounts holding a real payment (razorpayPaymentId set): financial records
 */

const { Op } = require('sequelize');

const models = () => require('../models');
const db = () => require('../config/database');

const MAX_BATCH = 200;

const hardDeleteUsers = async (ids, actorId) => {
  const { User, Subscription, UnlockPurchase } = models();
  const sequelize = db();

  const unique = [...new Set(ids)].slice(0, MAX_BATCH);
  const users = await User.findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ['id', 'email', 'role'],
  });
  const found = new Map(users.map((u) => [u.id, u]));

  const blocked = [];
  const eligible = [];
  for (const id of unique) {
    const u = found.get(id);
    if (!u) blocked.push({ id, reason: 'Not found' });
    else if (id === actorId) blocked.push({ id, email: u.email, reason: 'Cannot delete your own account' });
    else if (u.role !== 'user') blocked.push({ id, email: u.email, reason: `Staff account (${u.role}) — revoke the role first` });
    else eligible.push(u);
  }

  const eligibleIds = eligible.map((u) => u.id);
  if (eligibleIds.length) {
    const [paidSubs, paidUnlocks] = await Promise.all([
      Subscription.findAll({
        where: { userId: { [Op.in]: eligibleIds }, razorpayPaymentId: { [Op.ne]: null } },
        attributes: ['userId'],
      }),
      UnlockPurchase.findAll({
        where: { userId: { [Op.in]: eligibleIds }, razorpayPaymentId: { [Op.ne]: null } },
        attributes: ['userId'],
      }),
    ]);
    const paid = new Set([...paidSubs, ...paidUnlocks].map((r) => r.userId));
    for (const u of eligible) {
      if (paid.has(u.id)) blocked.push({ id: u.id, email: u.email, reason: 'Has a real payment on record — kept for accounting' });
    }
  }
  const deletable = eligible.filter((u) => !blocked.some((b) => b.id === u.id));
  const deleteIds = deletable.map((u) => u.id);

  if (deleteIds.length) {
    await sequelize.transaction(async (transaction) => {
      const replacements = { ids: deleteIds };
      const run = (sql) => sequelize.query(sql, { replacements, transaction });
      await run('UPDATE "Groups" SET "candidateUserId" = NULL WHERE "candidateUserId" IN (:ids)');
      // Groups a doomed user created go with them, members and messages first.
      await run('DELETE FROM "GroupMessages" WHERE "groupId" IN (SELECT id FROM "Groups" WHERE "createdBy" IN (:ids))');
      await run('DELETE FROM "GroupMembers" WHERE "groupId" IN (SELECT id FROM "Groups" WHERE "createdBy" IN (:ids))');
      await run('DELETE FROM "Groups" WHERE "createdBy" IN (:ids)');
      await run('DELETE FROM "GroupMessages" WHERE "senderId" IN (:ids)');
      await run('DELETE FROM "GroupMembers" WHERE "userId" IN (:ids)');
      await run('DELETE FROM "UnlockPurchases" WHERE "userId" IN (:ids)');
      await run('DELETE FROM "Users" WHERE id IN (:ids)');
    });
  }

  return {
    deleted: deletable.map((u) => ({ id: u.id, email: u.email })),
    blocked,
  };
};

module.exports = { hardDeleteUsers, MAX_BATCH };
