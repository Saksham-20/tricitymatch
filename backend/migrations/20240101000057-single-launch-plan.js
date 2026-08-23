'use strict';

/**
 * Collapse the launch ladder to ONE plan on sale: Premium, 90 days,
 * UNLIMITED contact unlocks, ₹1,199.
 *
 * WHY A MIGRATION AND NOT JUST THE DEFAULTS
 * `utils/launchOffer.js` DEFAULT_PLAN_OFFERS only ever applies on the FIRST
 * boot that has no `launch_offer` row (`initLaunchOffer` seeds, then returns
 * the stored blob forever after). Dev and prod both already carry a row from
 * the 2026-08-20 pricing deploy, so changing the defaults alone would ship a
 * five-tier page to every existing environment while the code claimed one.
 *
 * The rest of the blob — deadline, headline/subline, bundles, the founding
 * window — is carried across untouched. Only `plans` is rewritten, because
 * only the ladder is being decided here.
 *
 * REVERSIBLE: the previous `plans` map is snapshotted into its own settings
 * row first, and `down` restores it. (The snapshot row is inert — nothing
 * reads a key other than `launch_offer`, and `saveOffer` rebuilds its blob
 * from a fixed key list, so an admin edit cannot corrupt it.)
 */

const KEY = 'launch_offer';
const BACKUP_KEY = 'launch_offer_plans_pre_single';

// Mirrors utils/launchOffer.js DEFAULT_PLAN_OFFERS. Duplicated on purpose:
// a migration must describe the state it wrote at the time it ran, not follow
// a constant that moves under it on the next pricing change.
const SINGLE_PLAN_LADDER = {
  basic_premium: { hidden: true },
  premium_plus: { amount: 119900, mrp: 249900, duration: 90, contactUnlocks: null },
  elite: { hidden: true },
  vip: { hidden: true },
  nri: { hidden: true },
};

const readRow = async (queryInterface, key) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT "value" FROM "AppSettings" WHERE "key" = :key LIMIT 1',
    { replacements: { key } }
  );
  return rows.length ? rows[0].value : null;
};

const writeOffer = async (queryInterface, value) => {
  await queryInterface.sequelize.query(
    'UPDATE "AppSettings" SET "value" = :value, "updatedAt" = NOW() WHERE "key" = :key',
    { replacements: { key: KEY, value: JSON.stringify(value) } }
  );
};

module.exports = {
  async up(queryInterface) {
    const offer = await readRow(queryInterface, KEY);
    // No row yet: this environment has never booted the pricing layer, and
    // `initLaunchOffer` will seed the new single-plan defaults itself.
    if (!offer) return;

    await queryInterface.sequelize.query(
      `INSERT INTO "AppSettings" ("key", "value", "createdAt", "updatedAt")
       VALUES (:key, :value, NOW(), NOW())
       ON CONFLICT ("key") DO NOTHING`,
      { replacements: { key: BACKUP_KEY, value: JSON.stringify(offer.plans || {}) } }
    );

    await writeOffer(queryInterface, { ...offer, plans: SINGLE_PLAN_LADDER });
  },

  async down(queryInterface) {
    const offer = await readRow(queryInterface, KEY);
    if (!offer) return;
    const previous = await readRow(queryInterface, BACKUP_KEY);
    // Nothing to restore to (fresh install): leave the ladder alone rather
    // than guessing a five-tier map this environment never had.
    if (!previous) return;

    await writeOffer(queryInterface, { ...offer, plans: previous });
    await queryInterface.sequelize.query('DELETE FROM "AppSettings" WHERE "key" = :key', {
      replacements: { key: BACKUP_KEY },
    });
  },
};
