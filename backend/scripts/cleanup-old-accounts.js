/**
 * Remove old member accounts, keeping recent signups.
 *
 *   node scripts/cleanup-old-accounts.js                     # DRY RUN: list only
 *   node scripts/cleanup-old-accounts.js --days 30 --keep a@x.com,b@y.com
 *   node scripts/cleanup-old-accounts.js --execute           # actually delete
 *
 * Candidates: role 'user' AND joined more than --days ago (default 30).
 * Staff, and any account with a real payment, are refused by hardDeleteUsers.
 * Take a pg_dump BEFORE --execute; the delete cannot be undone.
 */

const { Op } = require('sequelize');
const { User, Profile } = require('../models');
const sequelize = require('../config/database');
const { hardDeleteUsers, MAX_BATCH } = require('../utils/hardDeleteUsers');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

(async () => {
  sequelize.options.logging = false;
  const days = parseInt(value('days', '30'), 10);
  const keep = new Set(value('keep', '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
  const cutoff = new Date(Date.now() - days * 86400000);

  const users = await User.findAll({
    where: { role: 'user', createdAt: { [Op.lt]: cutoff } },
    include: [{ model: Profile, attributes: ['firstName', 'lastName'] }],
    order: [['createdAt', 'ASC']],
  });
  const candidates = users.filter((u) => !keep.has(String(u.email).toLowerCase()));

  console.log(`Joined before ${cutoff.toISOString().slice(0, 10)}: ${users.length} users, ${keep.size} kept by --keep, ${candidates.length} candidates`);
  for (const u of candidates.slice(0, 200)) {
    const name = [u.Profile?.firstName, u.Profile?.lastName].filter(Boolean).join(' ') || '-';
    console.log(`  ${u.createdAt.toISOString().slice(0, 10)}  ${u.email}  (${name})`);
  }
  if (candidates.length > 200) console.log(`  ... and ${candidates.length - 200} more`);

  if (!flag('execute')) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --execute to delete.');
  } else {
    let deleted = 0;
    const blocked = [];
    for (let i = 0; i < candidates.length; i += MAX_BATCH) {
      const r = await hardDeleteUsers(candidates.slice(i, i + MAX_BATCH).map((u) => u.id), null);
      deleted += r.deleted.length;
      blocked.push(...r.blocked);
    }
    console.log(`\nDeleted ${deleted}. Kept ${blocked.length}:`);
    for (const b of blocked) console.log(`  ${b.email || b.id}: ${b.reason}`);
  }
  await sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
