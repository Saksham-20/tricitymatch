/**
 * Queue members whose stored date of birth is below the marriageable-age minimum
 * (21 men / 18 women / 21 other) for admin review. Nothing is suspended or
 * deleted: each member gets ONE pending 'underage' report in the Reports queue,
 * and an admin decides.
 *
 *   node scripts/flag-underage-members.js            # DRY RUN: list only
 *   node scripts/flag-underage-members.js --execute  # file the reports
 *   node scripts/flag-underage-members.js --reporter <adminUserId>
 *
 * Reports need a reporter; by default the oldest admin/super_admin account is
 * used, so the queue shows the source as "system review". A member who already
 * has an open underage report is skipped, so re-running is safe. The reports are
 * urgent (like a member-filed underage report) and marked as system reviews, so
 * working them does not notify the stand-in reporter.
 */

const { Op } = require('sequelize');
const { User, Profile, Report } = require('../models');
const sequelize = require('../config/database');
const { ageOn, minAgeFor } = require('../constants/marriageableAge');
const { fileUnderageReports } = require('../utils/underageFlag');

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const reporterArg = (() => {
  const i = args.indexOf('--reporter');
  return i >= 0 ? args[i + 1] : null;
})();

(async () => {
  sequelize.options.logging = false;
  const profiles = await Profile.findAll({
    where: { dateOfBirth: { [Op.ne]: null } },
    attributes: ['userId', 'gender', 'dateOfBirth'],
    include: [{ model: User, attributes: ['id', 'status'], where: { status: { [Op.ne]: 'banned' }, role: 'user' } }],
  });

  const under = profiles
    .map((p) => ({ p, age: ageOn(p.dateOfBirth), min: minAgeFor(p.gender) }))
    .filter((x) => x.age !== null && x.age < x.min);

  console.log(`${profiles.length} profiles checked, ${under.length} below their minimum age`);
  for (const { p, age, min } of under.slice(0, 200)) {
    console.log(`  ${p.userId}  gender=${p.gender || '-'}  age=${age}  minimum=${min}`);
  }

  if (!execute) {
    console.log('\nDRY RUN — no reports filed. Re-run with --execute to queue them.');
    await sequelize.close();
    return;
  }

  const reporter = reporterArg
    ? await User.findByPk(reporterArg, { attributes: ['id', 'role'] })
    : await User.findOne({ where: { role: { [Op.in]: ['admin', 'super_admin'] } }, order: [['createdAt', 'ASC']], attributes: ['id', 'role'] });
  if (!reporter) throw new Error('No admin account found to file the reports from; pass --reporter <userId>');

  const filed = await fileUnderageReports({ reporter, under, Report });
  console.log(`\nFiled ${filed} report(s) (${under.length - filed} already had one open).`);
  await sequelize.close();
})().catch(async (err) => {
  console.error(err.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
