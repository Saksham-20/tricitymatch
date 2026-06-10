'use strict';

/**
 * Migration: Add Search Filter Indexes
 *
 * Adds indexes for Profiles search columns frequently used in filtering:
 * - dateOfBirth (age filter)
 * - maritalStatus (filter)
 * - education (filter)
 * - diet (filter)
 * - religion (filter, lowercase for case-insensitive search)
 * - motherTongue (filter, lowercase for case-insensitive search)
 *
 * Also adds composite index (gender, isActive, createdAt) to optimize base search query.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const run = (sql) => sequelize.query(sql);

    // ==================== PROFILES TABLE ====================
    // Base search query index: gender + active status + default sort (createdAt desc)
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_gender_active_created ON "Profiles" (gender, "isActive", "createdAt" DESC);');

    // Age filter: dateOfBirth range queries
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_dob ON "Profiles" ("dateOfBirth");');

    // Other filter fields
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_marital_status ON "Profiles" ("maritalStatus");');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_education ON "Profiles" (education);');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_diet ON "Profiles" (diet);');

    // Religion and motherTongue with LOWER() for case-insensitive matching
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_religion_lower ON "Profiles" (LOWER(religion));');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_mother_tongue_lower ON "Profiles" (LOWER("motherTongue"));');
  },

  async down(queryInterface, Sequelize) {
    // Remove all indexes in reverse order
    await queryInterface.removeIndex('Profiles', 'idx_profiles_mother_tongue_lower');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_religion_lower');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_diet');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_education');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_marital_status');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_dob');
    await queryInterface.removeIndex('Profiles', 'idx_profiles_gender_active_created');
  }
};
