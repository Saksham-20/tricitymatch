/**
 * Funnel event tracking (Phase 0.5).
 *
 * trackEvent is fire-and-forget on the request path, so the thing that can
 * silently rot is exactly what these tests pin: the allowlist gate, and the
 * guarantee that a broken analytics insert never escapes into the response.
 * Every test AWAITS the returned promise — a test that fires and forgets would
 * pass vacuously whether or not the util actually swallowed the failure.
 *
 * Pure unit test: the DB and the logger are mocked, nothing connects.
 */

jest.mock('../../config/database', () => ({
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../middlewares/logger', () => ({
  log: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const sequelize = require('../../config/database');
const { log } = require('../../middlewares/logger');
const { trackEvent } = require('../../utils/trackEvent');

const sqlOf = (call) => call[0].replace(/\s+/g, ' ').trim();

describe('trackEvent — allowlist', () => {
  it('rejects an unknown eventType without touching the DB', async () => {
    await trackEvent('user-1', 'definitely_not_a_stage');

    expect(sequelize.query).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown eventType'),
      expect.objectContaining({ eventType: 'definitely_not_a_stage', userId: 'user-1' })
    );
  });

  it('rejects a missing/undefined eventType', async () => {
    await trackEvent('user-1', undefined);

    expect(sequelize.query).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it('accepts every stage of the shipped funnel', async () => {
    const stages = [
      'otp_send_attempted',
      'otp_verify_succeeded',
      'account_created',
      'profile_60pct',
      'first_interest_sent',
      'invited_signup',
    ];

    for (const stage of stages) {
      await trackEvent('user-1', stage);
    }

    expect(sequelize.query).toHaveBeenCalledTimes(stages.length);
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe('trackEvent — account-bound events', () => {
  it('inserts with ON CONFLICT DO NOTHING so repeats are a no-op, not an error', async () => {
    await trackEvent('user-1', 'first_interest_sent');

    expect(sequelize.query).toHaveBeenCalledTimes(1);
    const [sql, options] = sequelize.query.mock.calls[0];
    const flat = sqlOf(sequelize.query.mock.calls[0]);

    expect(flat).toContain('INSERT INTO "AnalyticsEvents"');
    expect(flat).toContain('ON CONFLICT ("userId", "eventType") WHERE "userId" IS NOT NULL DO NOTHING');
    expect(options.replacements).toMatchObject({ userId: 'user-1', eventType: 'first_interest_sent' });
    expect(options.replacements.id).toEqual(expect.any(String));
    expect(sql).toBeTruthy();
  });
});

describe('trackEvent — pre-account counters (NULL userId)', () => {
  it.each(['otp_send_attempted', 'otp_verify_succeeded'])(
    'accepts %s with no userId and inserts plainly (NULLs cannot conflict)',
    async (stage) => {
      await trackEvent(null, stage);

      expect(sequelize.query).toHaveBeenCalledTimes(1);
      const flat = sqlOf(sequelize.query.mock.calls[0]);
      const [, options] = sequelize.query.mock.calls[0];

      expect(flat).toContain('INSERT INTO "AnalyticsEvents"');
      expect(flat).toContain('NULL');
      expect(flat).not.toContain('ON CONFLICT');
      expect(options.replacements).toEqual({ id: expect.any(String), eventType: stage });
      expect(log.warn).not.toHaveBeenCalled();
    }
  );

  it('treats undefined userId the same as null', async () => {
    await trackEvent(undefined, 'otp_send_attempted');

    const flat = sqlOf(sequelize.query.mock.calls[0]);
    expect(flat).not.toContain('ON CONFLICT');
  });
});

describe('trackEvent — never throws into a request', () => {
  it('swallows a DB failure and logs it with the event context', async () => {
    sequelize.query.mockRejectedValueOnce(new Error('connection terminated'));

    // Must RESOLVE, not reject: a rejection here would become an unhandled
    // rejection in the controllers (which never await this call).
    await expect(trackEvent('user-1', 'account_created')).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.objectContaining({
        eventType: 'account_created',
        userId: 'user-1',
        error: 'connection terminated',
      })
    );
  });

  it('swallows a failure on the NULL-userId path too', async () => {
    sequelize.query.mockRejectedValueOnce(new Error('relation does not exist'));

    await expect(trackEvent(null, 'otp_send_attempted')).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.objectContaining({ eventType: 'otp_send_attempted', userId: null })
    );
  });

  it('returns a promise (callers fire and forget, so it must be awaitable)', () => {
    const returned = trackEvent('user-1', 'profile_60pct');
    expect(typeof returned.then).toBe('function');
    return returned;
  });
});
