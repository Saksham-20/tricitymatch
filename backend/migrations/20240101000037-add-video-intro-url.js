'use strict';

/**
 * Migration: Add videoIntroUrl to Profiles
 *
 * Video intro mirrors the existing voiceIntroUrl — a short (~30s) self-intro
 * video stored on Cloudinary (resource_type 'video'). Nullable string column.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Profiles');
    if (!table.videoIntroUrl) {
      await queryInterface.addColumn('Profiles', 'videoIntroUrl', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Profiles');
    if (table.videoIntroUrl) {
      await queryInterface.removeColumn('Profiles', 'videoIntroUrl');
    }
  }
};
