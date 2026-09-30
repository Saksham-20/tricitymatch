'use strict';

// Canonical education level and profession group, derived from the text a
// member typed (audit P2, constants/vocabularies). The typed text is untouched.
// Backfills existing rows one distinct value at a time, so a large table costs
// as many UPDATEs as it has distinct spellings, not one per profile.
const { normalizeEducation, normalizeProfession } = require('../constants/vocabularies');

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Profiles');
    if (!cols.educationLevel) {
      await queryInterface.addColumn('Profiles', 'educationLevel', { type: Sequelize.STRING(16), allowNull: true });
    }
    if (!cols.professionGroup) {
      await queryInterface.addColumn('Profiles', 'professionGroup', { type: Sequelize.STRING(40), allowNull: true });
    }

    const backfill = async (source, target, normalize) => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT DISTINCT "${source}" AS value FROM "Profiles" WHERE "${source}" IS NOT NULL AND btrim("${source}") <> ''`
      );
      for (const { value } of rows) {
        const derived = normalize(value);
        if (!derived) continue;
        await queryInterface.sequelize.query(
          `UPDATE "Profiles" SET "${target}" = :derived WHERE "${source}" = :value AND "${target}" IS DISTINCT FROM :derived`,
          { replacements: { derived, value } }
        );
      }
    };
    await backfill('education', 'educationLevel', normalizeEducation);
    await backfill('profession', 'professionGroup', normalizeProfession);

    await queryInterface.addIndex('Profiles', ['educationLevel'], { name: 'profiles_education_level_idx' }).catch(() => {});
    await queryInterface.addIndex('Profiles', ['professionGroup'], { name: 'profiles_profession_group_idx' }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Profiles', 'profiles_profession_group_idx').catch(() => {});
    await queryInterface.removeIndex('Profiles', 'profiles_education_level_idx').catch(() => {});
    await queryInterface.removeColumn('Profiles', 'professionGroup');
    await queryInterface.removeColumn('Profiles', 'educationLevel');
  },
};
