'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Verifications', 'bgCheckStatus', {
      type: Sequelize.ENUM('not_requested', 'pending_payment', 'in_progress', 'passed', 'failed'),
      defaultValue: 'not_requested',
      allowNull: false,
    });

    await queryInterface.addColumn('Verifications', 'bgCheckRequestedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Verifications', 'bgCheckCompletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Verifications', 'bgCheckRazorpayOrderId', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    await queryInterface.addColumn('Verifications', 'bgCheckRazorpayPaymentId', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    // Stores third-party report reference (e.g. AuthBridge report ID)
    await queryInterface.addColumn('Verifications', 'bgCheckReportRef', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Selfie liveness check status (APP-052)
    await queryInterface.addColumn('Verifications', 'selfieStatus', {
      type: Sequelize.ENUM('not_submitted', 'pending', 'passed', 'failed'),
      defaultValue: 'not_submitted',
      allowNull: false,
    });

    await queryInterface.addColumn('Verifications', 'selfieVideoUrl', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Verifications', 'bgCheckStatus');
    await queryInterface.removeColumn('Verifications', 'bgCheckRequestedAt');
    await queryInterface.removeColumn('Verifications', 'bgCheckCompletedAt');
    await queryInterface.removeColumn('Verifications', 'bgCheckRazorpayOrderId');
    await queryInterface.removeColumn('Verifications', 'bgCheckRazorpayPaymentId');
    await queryInterface.removeColumn('Verifications', 'bgCheckReportRef');
    await queryInterface.removeColumn('Verifications', 'selfieStatus');
    await queryInterface.removeColumn('Verifications', 'selfieVideoUrl');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Verifications_bgCheckStatus"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Verifications_selfieStatus"');
  },
};
