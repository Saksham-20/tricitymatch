'use strict';

/**
 * The client beacon is unauthenticated, so the thing worth locking down is what
 * a stranger with curl can write into the only conversion numbers we have.
 *
 * `account_created` and friends are emitted server-side from the controllers.
 * If the browser could report them, a loop could manufacture a signup funnel.
 */

jest.mock('../../config/database', () => ({
  query: jest.fn().mockResolvedValue([]),
}));

const { CLIENT_EVENT_TYPES, EVENT_TYPES } = require('../../utils/trackEvent');
const { recordClientEvent } = require('../../controllers/analyticsController');

const settle = () => new Promise((resolve) => setImmediate(resolve));

const call = async (body) => {
  const req = { body };
  const res = { status: jest.fn().mockReturnThis(), end: jest.fn() };
  await recordClientEvent(req, res, jest.fn());
  await settle();
  return res;
};

describe('client analytics beacon', () => {
  beforeEach(() => {
    require('../../config/database').query.mockClear();
  });

  it('accepts the four traffic stages', async () => {
    for (const name of CLIENT_EVENT_TYPES) {
      const res = await call({ name });
      expect(res.status).toHaveBeenCalledWith(204);
    }
    expect(require('../../config/database').query).toHaveBeenCalledTimes(CLIENT_EVENT_TYPES.length);
  });

  it('refuses to record an account-funnel stage from the browser', async () => {
    // The whole point: these must only ever come from the server.
    for (const name of ['account_created', 'profile_60pct', 'first_interest_sent']) {
      const res = await call({ name });
      expect(res.status).toHaveBeenCalledWith(204); // silently ignored, not an error
    }
    expect(require('../../config/database').query).not.toHaveBeenCalled();
  });

  it('ignores junk without erroring', async () => {
    for (const body of [{}, { name: '' }, { name: 42 }, { name: 'DROP TABLE' }, null]) {
      const res = await call(body);
      expect(res.status).toHaveBeenCalledWith(204);
    }
    expect(require('../../config/database').query).not.toHaveBeenCalled();
  });

  it('keeps every client stage inside the master allowlist', () => {
    // A stage the client may send but trackEvent rejects would silently drop.
    for (const name of CLIENT_EVENT_TYPES) {
      expect(EVENT_TYPES).toContain(name);
    }
  });
});
