'use strict';

/**
 * D2 — rich message fields, all additive (legacy shipped builds keep working:
 * old rows read as messageType 'text' with null media/reply and {} reactions).
 *
 *  - messageType: ENUM('text','voice') on Postgres, STRING elsewhere (the
 *    sqlite unit suite — same dialect split as 000048).
 *  - mediaUrl / mediaDurationMs: Cloudinary URL + duration for voice notes.
 *  - replyToId: self-FK quote-reply, ON DELETE SET NULL so deleting the quoted
 *    message degrades the quote instead of cascading the reply away.
 *  - reactions: JSONB {"❤️":[userIds]} — columns not tables: 1:1 chat, max two
 *    reactors, no joins. Toggles run under a row lock (ES3).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    await queryInterface.addColumn('Messages', 'messageType', {
      type: dialect === 'postgres'
        ? Sequelize.ENUM('text', 'voice')
        : Sequelize.STRING,
      allowNull: false,
      defaultValue: 'text',
    });

    await queryInterface.addColumn('Messages', 'mediaUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Messages', 'mediaDurationMs', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('Messages', 'replyToId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Messages', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('Messages', 'reactions', {
      type: dialect === 'postgres' ? Sequelize.JSONB : Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Messages', 'reactions');
    await queryInterface.removeColumn('Messages', 'replyToId');
    await queryInterface.removeColumn('Messages', 'mediaDurationMs');
    await queryInterface.removeColumn('Messages', 'mediaUrl');
    await queryInterface.removeColumn('Messages', 'messageType');
    // The Postgres enum type outlives removeColumn; drop it explicitly so a
    // re-run of `up` can recreate it (precedent: enum handling in 000048).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Messages_messageType";');
    }
  },
};
