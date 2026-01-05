'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Profiles', 'interestTags', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      defaultValue: [],
      allowNull: true
    });

    await queryInterface.addColumn('Profiles', 'profilePrompts', {
      type: Sequelize.JSONB,
      allowNull: true
      // e.g., { prompt1: "I'm looking for someone who...", answer1: "...", prompt2: "...", answer2: "..." }
    });

    await queryInterface.addColumn('Profiles', 'spotifyPlaylist', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('Profiles', 'socialMediaLinks', {
      type: Sequelize.JSONB,
      allowNull: true
      // e.g., { instagram: "url", linkedin: "url", facebook: "url", twitter: "url" }
    });

    await queryInterface.addColumn('Profiles', 'personalityType', {
      type: Sequelize.STRING,
      allowNull: true
      // MBTI, Enneagram, etc.
    });

    await queryInterface.addColumn('Profiles', 'languages', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      defaultValue: [],
      allowNull: true
    });

    await queryInterface.addColumn('Profiles', 'incognitoMode', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });

    await queryInterface.addColumn('Profiles', 'photoBlurUntilMatch', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Profiles', 'interestTags');
    await queryInterface.removeColumn('Profiles', 'profilePrompts');
    await queryInterface.removeColumn('Profiles', 'spotifyPlaylist');
    await queryInterface.removeColumn('Profiles', 'socialMediaLinks');
    await queryInterface.removeColumn('Profiles', 'personalityType');
    await queryInterface.removeColumn('Profiles', 'languages');
    await queryInterface.removeColumn('Profiles', 'incognitoMode');
    await queryInterface.removeColumn('Profiles', 'photoBlurUntilMatch');
  }
};



