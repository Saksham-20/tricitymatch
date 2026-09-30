'use strict';

const { fingerprintOf } = require('../utils/verificationFingerprint');

// Photo-verification integrity (audit P1-7): remember what the reviewer compared
// so a later photo/name change withdraws the badge. Existing approvals are
// stamped with their CURRENT profile, so the very next change is caught (an
// unset fingerprint would make the whole existing badge population immune).
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Verifications');
    if (!cols.approvedFingerprint) {
      await queryInterface.addColumn('Verifications', 'approvedFingerprint', { type: Sequelize.STRING(64), allowNull: true });
    }
    const [rows] = await queryInterface.sequelize.query(
      `SELECT v."id", p."profilePhoto", p."firstName", p."lastName", p."dateOfBirth", p."gender"
         FROM "Verifications" v JOIN "Profiles" p ON p."userId" = v."userId"
        WHERE v."status" = 'approved' AND v."approvedFingerprint" IS NULL`
    );
    for (const r of rows) {
      await queryInterface.sequelize.query(
        'UPDATE "Verifications" SET "approvedFingerprint" = :fp WHERE "id" = :id',
        { replacements: { fp: fingerprintOf(r), id: r.id } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Verifications', 'approvedFingerprint');
  },
};
