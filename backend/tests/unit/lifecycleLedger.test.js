'use strict';

/**
 * Root cause of the 2026-09-18 mail flood: migration 000060 created
 * `lifecycleMail` on Subscriptions and Users, but neither Sequelize model
 * declared it. Sequelize silently DROPS a key it has no attribute for, so
 *
 *     sub.update({ lifecycleMail: { abandoned: <ts> } })
 *
 * wrote nothing, `sub.lifecycleMail` always read undefined, and the "already
 * sent" check was permanently false — one abandoned order was mailed on every
 * hourly run for days (24+ copies in a day to one inbox).
 *
 * These use the REAL models (not mocks), because a mocked model would happily
 * accept any key and hide exactly this class of bug.
 */

const { Subscription, User } = require('../../models');

describe.each([
  ['Subscription', Subscription],
  ['User', User],
])('%s.lifecycleMail', (_name, Model) => {
  it('is a declared JSONB attribute (an undeclared one is silently dropped on write)', () => {
    expect(Model.rawAttributes.lifecycleMail).toBeDefined();
    expect(Model.rawAttributes.lifecycleMail.type.key).toBe('JSONB');
  });

  it('keeps what is written to it', () => {
    const row = Model.build({});
    row.set('lifecycleMail', { paymentFailed: '2026-09-19T10:00:00.000Z' });

    expect(row.lifecycleMail).toEqual({ paymentFailed: '2026-09-19T10:00:00.000Z' });
    expect(row.changed()).toContain('lifecycleMail');
  });

  it('is internal bookkeeping and never serialised into an API response', () => {
    const row = Model.build({});
    row.set('lifecycleMail', { photoNudge1: 'x' });

    expect(row.toJSON()).not.toHaveProperty('lifecycleMail');
  });
});
