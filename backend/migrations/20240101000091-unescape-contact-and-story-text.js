'use strict';

/**
 * Undo the HTML-escaping the public contact form and success-story submission
 * were stored with (SITE-07).
 *
 * The validators ran express-validator's .escape() before storage, so rows hold
 * entities (& as &amp;, ' as &#x27;, / as &#x2F; ...). React and the email
 * templates escape on output, so members and admins saw them twice-encoded.
 * New rows are stored as typed; this brings the existing ones in line.
 *
 * One pass, &amp; last, so text the sender really typed as "&lt;" (stored as
 * "&amp;lt;") comes back as "&lt;" and not "<". `down` is a no-op: re-escaping
 * would reintroduce the bug and the original strings are not kept.
 */
const UNESCAPE = (col) => `
  replace(replace(replace(replace(replace(replace(replace(replace(${col},
    '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#x27;', ''''),
    '&#x2F;', '/'), '&#x5C;', E'\\\\'), '&#96;', '\`'), '&amp;', '&')`;

const ENTITY = '&(amp|lt|gt|quot|#x27|#x2F|#x5C|#96);';

const TARGETS = {
  ContactMessages: ['name', 'phone', 'subject', 'message'],
  SuccessStories: ['coupleNames', 'location', 'quote'],
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    for (const [table, columns] of Object.entries(TARGETS)) {
      const [[exists]] = await sequelize.query(`SELECT to_regclass('public."${table}"') AS t`);
      if (!exists.t) continue;
      for (const col of columns) {
        const [found] = await sequelize.query(
          `SELECT 1 AS ok FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col}'`
        );
        if (!found.length) continue;
        await sequelize.query(
          `UPDATE "${table}" SET "${col}" = ${UNESCAPE(`"${col}"`)} WHERE "${col}" ~ '${ENTITY}'`
        );
      }
    }
  },

  async down() {},
};
