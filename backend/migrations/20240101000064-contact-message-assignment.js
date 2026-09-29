'use strict';

// Support enquiries can be assigned to a staff member so two admins don't
// answer the same enquiry and each person sees their own queue.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ContactMessages');
    if (!table.assignedTo) {
      await queryInterface.addColumn('ContactMessages', 'assignedTo', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      });
    }
    if (!table.assignedAt) {
      await queryInterface.addColumn('ContactMessages', 'assignedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    await queryInterface.addIndex('ContactMessages', ['assignedTo'], { name: 'contact_messages_assigned_to' }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ContactMessages', 'contact_messages_assigned_to').catch(() => {});
    await queryInterface.removeColumn('ContactMessages', 'assignedAt');
    await queryInterface.removeColumn('ContactMessages', 'assignedTo');
  },
};
