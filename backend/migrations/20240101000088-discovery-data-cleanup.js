'use strict';

// Discovery data clean-up (feature interrogation DISC-15, DISC-17).
//
//  1. Caste: writes canonicalise 'Jat Sikh' -> 'Jatt' (constants/vocabularies),
//     but the education/profession vocabulary migration never backfilled caste,
//     so older rows keep their original spelling and a canonical filter missed
//     them. Rewrites each DISTINCT stored value that is an exact/alias match of a
//     known caste, one UPDATE per distinct spelling. Text that is not a known
//     caste is left exactly as the member wrote it.
//
//  2. preferredCity: the column carried a database default of the three core
//     cities, so nearly every profile "stated" a city preference nobody chose.
//     The default is dropped (null = no preference) and rows that still hold
//     exactly that default are cleared, EXCEPT members who ticked the city
//     must-have: they have an explicit requirement and keep their list.
const { CASTES, normalizeCaste } = require('../constants/vocabularies');

const DEFAULT_CITIES = ['Chandigarh', 'Mohali', 'Panchkula'];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const cols = await queryInterface.describeTable('Profiles');

    if (cols.caste) {
      const known = new Set(CASTES);
      const [rows] = await sequelize.query(
        `SELECT DISTINCT "caste" AS value FROM "Profiles" WHERE "caste" IS NOT NULL AND btrim("caste") <> ''`
      );
      for (const { value } of rows) {
        const canonical = normalizeCaste(value);
        // Only a recognised caste is rewritten: an unknown spelling stays as typed.
        if (!canonical || canonical === value || !known.has(canonical)) continue;
        await sequelize.query(
          `UPDATE "Profiles" SET "caste" = :canonical WHERE "caste" = :value`,
          { replacements: { canonical, value } }
        );
      }
    }

    if (cols.preferredCity) {
      await sequelize.query(`ALTER TABLE "Profiles" ALTER COLUMN "preferredCity" DROP DEFAULT`);
      const hasMustHaves = !!cols.mustHavePreferences;
      await sequelize.query(
        `UPDATE "Profiles" SET "preferredCity" = NULL
          WHERE "preferredCity" = ARRAY[:cities]::varchar(255)[]
          ${hasMustHaves ? `AND NOT COALESCE("mustHavePreferences" @> '["city"]'::jsonb, false)` : ''}`,
        { replacements: { cities: DEFAULT_CITIES } }
      );
    }
  },

  async down(queryInterface) {
    // The caste rewrite is not reversible (the original spellings are gone) and
    // is harmless to keep. Restore the column default only.
    const cols = await queryInterface.describeTable('Profiles');
    if (cols.preferredCity) {
      await queryInterface.sequelize.query(
        `ALTER TABLE "Profiles" ALTER COLUMN "preferredCity" SET DEFAULT ARRAY['Chandigarh','Mohali','Panchkula']::varchar(255)[]`
      );
    }
  },
};
