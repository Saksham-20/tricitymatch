'use strict';

// Onboarding completion tracking + remove placeholder-default leakage.
// - Adds Profiles.onboardingComplete (authoritative flag the mobile RootNavigator
//   uses to decide Onboarding vs Main; web sets it at signup since web collects the
//   full profile before creating the account).
// - Makes gender/dateOfBirth NULLABLE so a mobile account (email+password only) is
//   not seeded with placeholder 'other' / 2000-01-01 values that pre-fill onboarding
//   Step 1 with wrong data. calculateAge() and compatibility already guard nulls.
// - Backfills every existing row to onboardingComplete = true (they predate
//   signup-without-onboarding and are already using the app).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Profiles', 'onboardingComplete', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Existing profiles are considered already onboarded.
    await queryInterface.sequelize.query(
      'UPDATE "Profiles" SET "onboardingComplete" = true;'
    );

    await queryInterface.changeColumn('Profiles', 'gender', {
      type: Sequelize.ENUM('male', 'female', 'other'),
      allowNull: true,
    });

    await queryInterface.changeColumn('Profiles', 'dateOfBirth', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Profiles', 'onboardingComplete');
    // Re-tightening gender/dateOfBirth to NOT NULL could fail on rows seeded after
    // this migration (mobile accounts mid-onboarding), so leave them nullable.
  },
};
