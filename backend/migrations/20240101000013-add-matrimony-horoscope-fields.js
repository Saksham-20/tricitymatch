'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const run = (sql) => queryInterface.sequelize.query(sql);

        // ── Religious & Community Background ──
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "religion" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "caste" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "subCaste" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "gotra" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "motherTongue" VARCHAR(255)`);

        // ── Marital Status ──
        // Create ENUM types first (IF NOT EXISTS guards)
        await run(`DO $$ BEGIN CREATE TYPE enum_profiles_maritalStatus AS ENUM ('never_married','divorced','widowed','awaiting_divorce'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "maritalStatus" enum_profiles_maritalStatus`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "numberOfChildren" INTEGER DEFAULT 0`);

        // ── Horoscope & Kundli ──
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "placeOfBirth" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "birthTime" VARCHAR(255)`);

        await run(`DO $$ BEGIN CREATE TYPE enum_profiles_manglikStatus AS ENUM ('manglik','non_manglik','anshik_manglik','not_sure'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "manglikStatus" enum_profiles_manglikStatus`);

        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "zodiacSign" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "rashi" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "nakshatra" VARCHAR(255)`);

        // ── Family Details ──
        await run(`DO $$ BEGIN CREATE TYPE enum_profiles_familyType AS ENUM ('joint','nuclear'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "familyType" enum_profiles_familyType`);

        await run(`DO $$ BEGIN CREATE TYPE enum_profiles_familyStatus AS ENUM ('middle_class','upper_middle_class','affluent','rich'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "familyStatus" enum_profiles_familyStatus`);

        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "fatherOccupation" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "motherOccupation" VARCHAR(255)`);
        await run(`ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "numberOfSiblings" INTEGER DEFAULT 0`);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Profiles', 'religion');
        await queryInterface.removeColumn('Profiles', 'caste');
        await queryInterface.removeColumn('Profiles', 'subCaste');
        await queryInterface.removeColumn('Profiles', 'gotra');
        await queryInterface.removeColumn('Profiles', 'motherTongue');
        await queryInterface.removeColumn('Profiles', 'maritalStatus');
        await queryInterface.removeColumn('Profiles', 'numberOfChildren');
        await queryInterface.removeColumn('Profiles', 'placeOfBirth');
        await queryInterface.removeColumn('Profiles', 'birthTime');
        await queryInterface.removeColumn('Profiles', 'manglikStatus');
        await queryInterface.removeColumn('Profiles', 'zodiacSign');
        await queryInterface.removeColumn('Profiles', 'rashi');
        await queryInterface.removeColumn('Profiles', 'nakshatra');
        await queryInterface.removeColumn('Profiles', 'familyType');
        await queryInterface.removeColumn('Profiles', 'familyStatus');
        await queryInterface.removeColumn('Profiles', 'fatherOccupation');
        await queryInterface.removeColumn('Profiles', 'motherOccupation');
        await queryInterface.removeColumn('Profiles', 'numberOfSiblings');

        // Clean up ENUM types
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_maritalStatus";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_manglikStatus";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_familyType";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_familyStatus";');
    }
};
