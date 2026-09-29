/**
 * P1-10: real notification preferences, jobs that reach every user, message
 * retention on a stated period, and heartbeat metrics for the alerts.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const prefs = require('../../utils/notificationPrefs');

describe('notification preferences', () => {
  it('defaults: matches/interests/messages/profile views on, promotions off', () => {
    expect(prefs.resolvePrefs(null)).toEqual({ matches: true, interests: true, messages: true, profileViews: true, promotions: false });
  });

  it('stored booleans override defaults; junk and unknown keys are ignored', () => {
    expect(prefs.resolvePrefs({ matches: false, interests: 'no', bogus: true, promotions: true }))
      .toEqual({ matches: false, interests: true, messages: true, profileViews: true, promotions: true });
  });

  it('validates updates strictly', () => {
    expect(prefs.validatePrefsUpdate({ matches: false })).toEqual({ ok: true, patch: { matches: false } });
    expect(prefs.validatePrefsUpdate({ matches: 'false' }).ok).toBe(false);
    expect(prefs.validatePrefsUpdate({ payments: false }).ok).toBe(false); // not opt-out-able
    expect(prefs.validatePrefsUpdate({}).ok).toBe(false);
    expect(prefs.validatePrefsUpdate([]).ok).toBe(false);
  });

  it('isEnabled treats "no category" as always deliver', () => {
    expect(prefs.isEnabled({ matches: false }, undefined)).toBe(true);
    expect(prefs.isEnabled({ matches: false }, 'matches')).toBe(false);
  });
});

describe('notify() honours preferences', () => {
  const load = (stored) => {
    jest.resetModules();
    const create = jest.fn(async (r) => ({ id: 'n1', createdAt: new Date(), ...r }));
    const emit = jest.fn();
    jest.doMock('../../models', () => ({
      Notification: { create },
      User: { findByPk: jest.fn(async () => ({ id: 'u1', notificationPrefs: stored, fcmTokens: [] })), update: jest.fn() },
    }));
    jest.doMock('../../utils/socket', () => ({ getIO: () => ({ to: () => ({ emit }) }) }));
    jest.doMock('../../utils/fcm', () => ({ sendPushNotification: jest.fn(async () => ({ failedTokens: [] })) }));
    return { notify: require('../../utils/notifyUser').notify, create, emit };
  };

  it('creates and emits when the category is on', async () => {
    const { notify, create, emit } = load({ interests: true });
    await notify('u1', 'new_match', 't', 'b', null, { category: 'interests' });
    expect(create).toHaveBeenCalled();
    expect(emit).toHaveBeenCalled();
  });

  it('creates nothing when the member switched the category off', async () => {
    const { notify, create, emit } = load({ interests: false });
    const out = await notify('u1', 'new_match', 't', 'b', null, { category: 'interests' });
    expect(out).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('a notice with no category is never suppressed', async () => {
    const { notify, create } = load({ matches: false, interests: false });
    await notify('u1', 'system', 'Payment received', 'b');
    expect(create).toHaveBeenCalled();
  });
});

describe('forEachUserPage', () => {
  it('visits every user across pages, in id order, without repeats', async () => {
    const { forEachUserPage } = require('../../utils/batch');
    const all = Array.from({ length: 1201 }, (_, i) => ({ id: String(i).padStart(5, '0') }));
    const User = {
      findAll: jest.fn(async ({ where, limit }) => {
        const after = where.id ? where.id[Object.getOwnPropertySymbols(where.id)[0]] : null;
        return all.filter((u) => !after || u.id > after).slice(0, limit);
      }),
    };
    const seen = [];
    const total = await forEachUserPage(User, { where: { status: 'active' } }, async (users) => { seen.push(...users.map((u) => u.id)); }, 500);
    expect(total).toBe(1201);
    expect(new Set(seen).size).toBe(1201);
    expect(User.findAll).toHaveBeenCalledTimes(3);
    expect(User.findAll.mock.calls[0][0].order).toEqual([['id', 'ASC']]);
  });
});

describe('message retention', () => {
  const load = ({ months, rows }) => {
    jest.resetModules();
    const queries = [];
    const batches = [...rows];
    jest.doMock('../../config/env', () => ({ chat: { messageRetentionMonths: months } }));
    jest.doMock('../../config/database', () => ({
      query: jest.fn(async (sql, opts) => {
        queries.push({ sql, opts });
        if (/^\s*SELECT/i.test(sql)) return batches.shift() || [];
        return [];
      }),
    }));
    const destroyMedia = jest.fn(async () => ({}));
    jest.doMock('../../utils/memberMedia', () => ({ destroyMedia }));
    return { run: require('../../utils/messageRetention').runMessageRetention, queries, destroyMedia };
  };

  it('does nothing when set to 0 (keep forever)', async () => {
    const { run, queries } = load({ months: 0, rows: [[{ id: 'm1' }]] });
    expect(await run()).toEqual({ cleaned: 0, disabled: true });
    expect(queries).toHaveLength(0);
  });

  it('deletes messages older than the period and destroys their voice notes', async () => {
    const now = new Date('2026-09-29T00:00:00Z');
    const { run, queries, destroyMedia } = load({
      months: 24,
      rows: [[{ id: 'm1', mediaUrl: 'https://res.cloudinary.com/x/video/authenticated/s--a--/v1/a/b.m4a' }, { id: 'm2', mediaUrl: null }]],
    });
    const out = await run(now);
    expect(out).toEqual({ cleaned: 2, retentionMonths: 24 });
    expect(new Date(queries[0].opts.replacements.cutoff).toISOString().slice(0, 10)).toBe('2024-09-29');
    expect(destroyMedia).toHaveBeenCalledWith(['https://res.cloudinary.com/x/video/authenticated/s--a--/v1/a/b.m4a']);
    const del = queries.find((q) => /DELETE FROM "Messages"/.test(q.sql));
    expect(del.opts.replacements.ids).toEqual(['m1', 'm2']);
  });

  it('holds back conversations with an open report', async () => {
    const { run, queries } = load({ months: 24, rows: [[]] });
    await run();
    expect(queries[0].sql).toMatch(/NOT EXISTS[\s\S]*Reports[\s\S]*'pending', 'reviewing'/);
  });
});

describe('job heartbeat metrics', () => {
  it('exports last-success per job and the waiting gauge under the names the alerts read', () => {
    const m = require('../../utils/metrics');
    m.recordJobSuccess('expire-subscriptions', 1_700_000_000_000);
    m.setQueueWaiting(7);
    const text = m.getPrometheusMetrics();
    expect(text).toContain('tricitymatch_job_last_success_timestamp_seconds{job="expire-subscriptions"} 1700000000');
    expect(text).toContain('tricitymatch_queue_waiting_total 7');
  });
});
