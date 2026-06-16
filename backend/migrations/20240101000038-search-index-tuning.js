'use strict';

/**
 * Migration: Search Index Tuning
 *
 * DB-4: the Competitive-R1 search filters run unindexed → seq scans on Profiles.
 *   - income range (Op.gte/lte)        → btree
 *   - height range (Op.gte/lte)        → btree
 *   - manglikStatus equality/in        → btree
 *   - interestTags (Op.overlap)        → GIN (array overlap)
 *
 * DB-3: drop the duplicate Messages index. Migration 000012 created
 *   idx_messages_sender_receiver_created and 000025 created
 *   messages_sender_receiver_created_at on the SAME (senderId, receiverId, createdAt)
 *   columns → 2× write/maintenance cost on the hottest table. Keep the named one
 *   from 000025, drop the 000012 one.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const run = (sql) => sequelize.query(sql);

    // ---- DB-4: index the unindexed search filters ----
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_income ON "Profiles" (income);');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_height ON "Profiles" (height);');
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_manglik_status ON "Profiles" ("manglikStatus");');
    // GIN supports the Op.overlap (&&) array operator used for interestTags.
    await run('CREATE INDEX IF NOT EXISTS idx_profiles_interest_tags_gin ON "Profiles" USING GIN ("interestTags");');

    // ---- DB-3: drop the duplicate Messages index ----
    await run('DROP INDEX IF EXISTS idx_messages_sender_receiver_created;');
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const run = (sql) => sequelize.query(sql);

    // Recreate the dropped duplicate index (best-effort restore)
    await run('CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver_created ON "Messages" ("senderId", "receiverId", "createdAt");');

    await run('DROP INDEX IF EXISTS idx_profiles_interest_tags_gin;');
    await run('DROP INDEX IF EXISTS idx_profiles_manglik_status;');
    await run('DROP INDEX IF EXISTS idx_profiles_height;');
    await run('DROP INDEX IF EXISTS idx_profiles_income;');
  },
};
