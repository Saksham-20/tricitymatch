'use strict';

/**
 * D3 — like-with-note. Both columns nullable + additive (legacy clients keep
 * posting plain likes; rows read back with nulls).
 *
 *  - note: optional 280-char message attached to a like.
 *  - likedItem: JSONB SNAPSHOT of the thing that was liked (ES8):
 *      {type:'photo', photoUrl} | {type:'prompt', promptText}
 *    Snapshot, never an index — photo indexes rot when the target deletes or
 *    reorders their gallery; clients render from the snapshot and fall back to
 *    "a photo" when the URL is gone.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    await queryInterface.addColumn('Matches', 'note', {
      type: Sequelize.STRING(280),
      allowNull: true,
    });

    await queryInterface.addColumn('Matches', 'likedItem', {
      type: dialect === 'postgres' ? Sequelize.JSONB : Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Matches', 'likedItem');
    await queryInterface.removeColumn('Matches', 'note');
  },
};
