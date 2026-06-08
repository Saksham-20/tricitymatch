'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Profiles');

    if (!table.quizAnswers) {
      await queryInterface.addColumn('Profiles', 'quizAnswers', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    if (!table.voiceIntroUrl) {
      await queryInterface.addColumn('Profiles', 'voiceIntroUrl', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Profiles', 'quizAnswers');
    await queryInterface.removeColumn('Profiles', 'voiceIntroUrl');
  },
};
