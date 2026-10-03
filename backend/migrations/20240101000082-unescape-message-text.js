'use strict';

/**
 * Undo the HTML-escaping chat text was stored with.
 *
 * Until now every message was escaped on write (& to &amp; ' to &#x27; " to &quot;
 * < to &lt; > to &gt;) and no client decoded it, so members read entities. New
 * messages are stored as typed (utils/messageText); this brings the existing
 * rows in line. One pass only, with &amp; last, so a message the member
 * genuinely typed as "&lt;" (stored "&amp;lt;") comes back as "&lt;" and not "<".
 *
 * Text that the old sanitiser DELETED (anything shaped like a tag) is gone and
 * cannot be recovered. `down` is a no-op: re-escaping would only reintroduce the
 * bug, and the original strings are not kept.
 */
const UNESCAPE = (col) => `
  replace(replace(replace(replace(replace(${col},
    '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#x27;', ''''), '&amp;', '&')`;

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    for (const table of ['Messages', 'GroupMessages']) {
      const [[exists]] = await sequelize.query(`SELECT to_regclass('public."${table}"') AS t`);
      if (!exists.t) continue;
      await sequelize.query(
        `UPDATE "${table}" SET "content" = ${UNESCAPE('"content"')}
          WHERE "content" ~ '&(amp|lt|gt|quot|#x27);'`
      );
    }
  },

  async down() {},
};
