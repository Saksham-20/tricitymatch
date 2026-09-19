'use strict';

/**
 * Atomic edits to Users.lifecycleMail.
 *
 * The ledger has more than one writer: the lifecycle jobs stamp sends, and the
 * unsubscribe endpoint records a member's opt-out. A read-modify-write from a
 * stale instance — load 100 candidates, then send mail for twenty seconds, then
 * write the whole object back — would silently erase an opt-out that landed in
 * the meantime. Doing the merge inside Postgres means each writer touches only
 * its own keys.
 */

const sequelize = require('../config/database');

/**
 * @param {string} userId
 * @param {object} [set]    keys to set (values must be JSON-serialisable)
 * @param {string[]} [unset] keys to remove
 */
const patchUserLedger = (userId, set = {}, unset = []) =>
  sequelize.query(
    `UPDATE "Users"
        SET "lifecycleMail" = (COALESCE("lifecycleMail", '{}'::jsonb) - :unset::text[]) || :patch::jsonb
      WHERE id = :id`,
    {
      replacements: {
        id: userId,
        patch: JSON.stringify(set),
        unset: `{${unset.join(',')}}`,
      },
    }
  );

module.exports = { patchUserLedger };
