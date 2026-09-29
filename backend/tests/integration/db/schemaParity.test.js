/**
 * Every Sequelize model attribute has a real column, and back.
 *
 * Sequelize silently DROPS a write to an attribute the model does not declare.
 * That is how the lifecycle "already sent" ledger (migration 000060) never
 * persisted and members got ~25 mails a day. A mocked model cannot catch this;
 * only comparing the models against the migrated schema can.
 */

const { describeDb } = require('../../helpers/db');

// Columns that exist in the database on purpose with no model attribute: dormant
// columns kept after a feature was removed (no down-migration by decision).
const DORMANT = {
  Users: [],
  Verifications: ['documentType', 'documentFront', 'documentBack'],
};
const dormantOf = (table) => new Set(DORMANT[table] || []);

describeDb('schema parity (models vs migrated database)', (t) => {
  t('every model attribute is a column in its table', async (sequelize) => {
    const models = require('../../../models');
    const missing = [];
    let checked = 0;
    for (const model of Object.values(models)) {
      if (!model || !model.rawAttributes || !model.getTableName) continue;
      checked += 1;
      const table = model.getTableName();
      const [cols] = await sequelize.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = :table',
        { replacements: { table: String(table) } }
      );
      const have = new Set(cols.map((c) => c.column_name));
      for (const attr of Object.values(model.rawAttributes)) {
        if (attr.type && attr.type.key === 'VIRTUAL') continue;
        if (!have.has(attr.field)) missing.push(`${table}.${attr.field}`);
      }
    }
    expect(checked).toBeGreaterThan(25); // guards against the loop matching nothing
    expect(missing).toEqual([]);
  });

  t('every database column is declared on its model (a write to it would be dropped)', async (sequelize) => {
    const models = require('../../../models');
    const undeclared = [];
    for (const model of Object.values(models)) {
      if (!model || !model.rawAttributes || !model.getTableName) continue;
      const table = String(model.getTableName());
      const [cols] = await sequelize.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = :table',
        { replacements: { table } }
      );
      const declared = new Set(Object.values(model.rawAttributes).map((a) => a.field));
      const dormant = dormantOf(table);
      for (const { column_name: c } of cols) {
        if (!declared.has(c) && !dormant.has(c)) undeclared.push(`${table}.${c}`);
      }
    }
    expect(undeclared).toEqual([]);
  });
});
