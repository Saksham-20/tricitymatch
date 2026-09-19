'use strict';

/**
 * Spend the photo-nudge allowance of members who have already had it.
 *
 * The `lifecycleMail` ledger was undeclared on the Sequelize models until this
 * release, so the photo-nudge job never recorded a send and mailed every
 * no-photo member again at 11:00 every day. Now that the ledger persists, those
 * members would look like they had never been nudged and would get a fresh
 * "first" and "second" nudge on top of the daily ones they already received.
 *
 * Anyone who is a photo-nudge candidate right now (active, finished
 * onboarding, no photo, older than a day) was already in the job's audience,
 * so both nudges are marked as used and `lastSentAt` is stamped to hold any
 * other nudge back for a week. Members who sign up after this runs are not
 * touched and get the new cadence: at most two nudges, days apart.
 *
 * Data-only and idempotent (skips anyone already carrying photoNudge2).
 * `down` is a no-op: un-marking would re-arm the mail.
 */
const ISO_NOW = `to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Users" u
      SET "lifecycleMail" = COALESCE(u."lifecycleMail", '{}'::jsonb)
        || jsonb_build_object(
             'photoNudge1', ${ISO_NOW},
             'photoNudge2', ${ISO_NOW},
             'lastSentAt',  ${ISO_NOW}
           )
      FROM "Profiles" p
      WHERE p."userId" = u.id
        AND u.status = 'active'
        AND p."onboardingComplete" = true
        AND (p.photos IS NULL OR cardinality(p.photos) = 0)
        AND u."createdAt" < NOW() - INTERVAL '1 day'
        AND COALESCE(u."lifecycleMail"->>'photoNudge2', '') = '';
    `);
  },

  async down() {
    // Intentionally empty — see header.
  },
};
