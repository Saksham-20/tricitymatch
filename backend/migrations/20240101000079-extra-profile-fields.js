'use strict';

// Profile fields the audit found missing (P2): nationality, willingness to
// relocate, living arrangement, family values, institution, industry and the
// brothers/sisters split. All optional; nothing existing changes.
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Profiles');
    const add = async (name, spec) => {
      if (!cols[name]) await queryInterface.addColumn('Profiles', name, spec);
    };
    await add('nationality', { type: Sequelize.STRING(60), allowNull: true });
    await add('willingToRelocate', { type: Sequelize.STRING(8), allowNull: true });
    await add('livingArrangement', { type: Sequelize.STRING(20), allowNull: true });
    await add('familyValues', { type: Sequelize.STRING(16), allowNull: true });
    await add('institution', { type: Sequelize.STRING(120), allowNull: true });
    await add('industry', { type: Sequelize.STRING(60), allowNull: true });
    await add('brothers', { type: Sequelize.INTEGER, allowNull: true });
    await add('sisters', { type: Sequelize.INTEGER, allowNull: true });
  },
  async down(queryInterface) {
    for (const name of ['sisters', 'brothers', 'industry', 'institution', 'familyValues', 'livingArrangement', 'willingToRelocate', 'nationality']) {
      await queryInterface.removeColumn('Profiles', name);
    }
  },
};
