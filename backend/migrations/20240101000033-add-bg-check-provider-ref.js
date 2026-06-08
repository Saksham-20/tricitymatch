'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Verifications', 'bgCheckProviderRef', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Provider-assigned report/task ID used for webhook correlation (AuthBridge report_id or Signzy taskId)',
    });

    // Index for fast webhook lookup by providerRef
    await queryInterface.addIndex('Verifications', ['bgCheckProviderRef'], {
      name: 'verifications_bg_check_provider_ref_idx',
      where: { bgCheckProviderRef: { [Sequelize.Op.ne]: null } },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Verifications', 'verifications_bg_check_provider_ref_idx');
    await queryInterface.removeColumn('Verifications', 'bgCheckProviderRef');
  },
};
