'use strict';

/**
 * Re-price the single launch plan: Premium 90 days, unlimited unlocks,
 * ₹1,199 → ₹1,099.
 *
 * WHY A MIGRATION AND NOT JUST THE DEFAULTS
 * Same reason as 000057: `utils/launchOffer.js` DEFAULT_PLAN_OFFERS only ever
 * applies on the FIRST boot that has no `launch_offer` row. Dev and prod both
 * carry one, so moving the constant alone would leave every existing
 * environment charging the old price while the code claimed the new one.
 *
 * Only `plans.premium_plus.amount` is touched. Everything else the admin
 * editor owns — which tiers are on sale, MRP anchors, tenures, unlock caps,
 * deadline, headline, bundles, the founding window — is carried across
 * verbatim, so an admin edit made after 000057 is not stomped by this.
 *
 * REVERSIBLE: `down` puts 119900 back, but only if the stored amount is still
 * the 109900 this migration wrote — an admin who has since re-priced by hand
 * keeps their number rather than being silently reverted to a stale one.
 */

const KEY = 'launch_offer';
const OLD_AMOUNT = 119900;
const NEW_AMOUNT = 109900;

// The full tier as it should read if the stored blob somehow has no
// premium_plus entry. Duplicated from utils/launchOffer.js on purpose: a
// migration describes the state it wrote when it ran, not a moving constant.
const PREMIUM_FALLBACK = { amount: NEW_AMOUNT, mrp: 249900, duration: 90, contactUnlocks: null };

const readOffer = async (queryInterface) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT "value" FROM "AppSettings" WHERE "key" = :key LIMIT 1',
    { replacements: { key: KEY } }
  );
  return rows.length ? rows[0].value : null;
};

const writeOffer = async (queryInterface, value) => {
  await queryInterface.sequelize.query(
    'UPDATE "AppSettings" SET "value" = :value, "updatedAt" = NOW() WHERE "key" = :key',
    { replacements: { key: KEY, value: JSON.stringify(value) } }
  );
};

const reprice = async (queryInterface, from, to) => {
  const offer = await readOffer(queryInterface);
  // No row yet: this environment has never booted the pricing layer, and
  // `initLaunchOffer` seeds the current defaults itself.
  if (!offer) return;

  const plans = { ...(offer.plans || {}) };
  const premium = plans.premium_plus;

  if (!premium || typeof premium.amount !== 'number') {
    plans.premium_plus = { ...PREMIUM_FALLBACK, amount: to };
  } else if (premium.amount === from) {
    plans.premium_plus = { ...premium, amount: to };
  } else {
    // Hand-priced since — leave it alone rather than overwrite a live decision.
    return;
  }

  await writeOffer(queryInterface, { ...offer, plans });
};

module.exports = {
  async up(queryInterface) {
    await reprice(queryInterface, OLD_AMOUNT, NEW_AMOUNT);
  },

  async down(queryInterface) {
    await reprice(queryInterface, NEW_AMOUNT, OLD_AMOUNT);
  },
};
