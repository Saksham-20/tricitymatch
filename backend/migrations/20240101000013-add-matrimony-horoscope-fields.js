'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // ── Religious & Community Background ──
        await queryInterface.addColumn('Profiles', 'religion', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'caste', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'subCaste', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'gotra', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'motherTongue', {
            type: Sequelize.STRING,
            allowNull: true
        });

        // ── Marital Status ──
        await queryInterface.addColumn('Profiles', 'maritalStatus', {
            type: Sequelize.ENUM('never_married', 'divorced', 'widowed', 'awaiting_divorce'),
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'numberOfChildren', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
        });

        // ── Horoscope & Kundli ──
        await queryInterface.addColumn('Profiles', 'placeOfBirth', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'birthTime', {
            type: Sequelize.STRING, // HH:MM format
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'manglikStatus', {
            type: Sequelize.ENUM('manglik', 'non_manglik', 'anshik_manglik', 'not_sure'),
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'zodiacSign', {
            type: Sequelize.STRING, // Western zodiac: Aries–Pisces
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'rashi', {
            type: Sequelize.STRING, // Vedic moon sign: Mesh–Meen
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'nakshatra', {
            type: Sequelize.STRING, // 27 nakshatras
            allowNull: true
        });

        // ── Family Details ──
        await queryInterface.addColumn('Profiles', 'familyType', {
            type: Sequelize.ENUM('joint', 'nuclear'),
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'familyStatus', {
            type: Sequelize.ENUM('middle_class', 'upper_middle_class', 'affluent', 'rich'),
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'fatherOccupation', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'motherOccupation', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('Profiles', 'numberOfSiblings', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
        });
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
