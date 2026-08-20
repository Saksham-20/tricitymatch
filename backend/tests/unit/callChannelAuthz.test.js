/**
 * Agora RTC token channel binding (H-1).
 *
 * An RTC token is a joining credential for whatever channel it names. This
 * endpoint used to mint one for ANY channel string, so any premium member could
 * join a stranger's live call — initiateCall's mutual-match gate was bypassed by
 * simply asking for the channel directly. Astrologer channels are the guessable
 * `ast_<bookingId>`, which made enumeration trivial.
 */

jest.mock('../../models', () => ({
  CallSession: { findOne: jest.fn() },
  User: {},
  Profile: {},
  Match: {},
  AstrologerBooking: { findOne: jest.fn() },
}));

jest.mock('../../utils/agoraToken', () => ({
  generateRtcToken: jest.fn(() => ({
    token: 'REAL_TOKEN',
    channelName: 'c',
    uid: 0,
    expiresAt: 123,
  })),
}));

jest.mock('../../utils/socket', () => ({ getIO: jest.fn(() => null) }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));

const { CallSession, AstrologerBooking } = require('../../models');
const { generateRtcToken } = require('../../utils/agoraToken');
const { getAgoraToken } = require('../../controllers/callController');

const ATTACKER = 'attacker-id';
const VICTIM_CHANNEL = 'call_abc123victimchan';

// asyncHandler is `Promise.resolve(fn(...)).catch(next)` — it does NOT return
// the promise, so awaiting the handler alone resolves before the chain settles.
// Flush the queue so next()/res.json() have actually run before asserting.
const runHandler = async (req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  let thrown = null;
  await getAgoraToken(req, res, (err) => { thrown = err; });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, thrown };
};

const reqFor = (channel, userId = ATTACKER) => ({
  query: { channel },
  user: { id: userId },
});

describe('getAgoraToken channel authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CallSession.findOne.mockResolvedValue(null);
    AstrologerBooking.findOne.mockResolvedValue(null);
  });

  it('THE ATTACK: refuses to mint a token for a call the caller is not in', async () => {
    const { res, thrown } = await runHandler(reqFor(VICTIM_CHANNEL));

    expect(thrown).toMatchObject({ statusCode: 403 });
    expect(res.json).not.toHaveBeenCalled();
    // The credential must never be generated at all, not merely withheld.
    expect(generateRtcToken).not.toHaveBeenCalled();
  });

  it('scopes the session lookup to the caller and to live calls only', async () => {
    await runHandler(reqFor(VICTIM_CHANNEL));

    const { where } = CallSession.findOne.mock.calls[0][0];
    expect(where.channelName).toBe(VICTIM_CHANNEL);
    // An ended/declined call must not keep handing out join credentials.
    const statusClause = where.status[Object.getOwnPropertySymbols(where.status)[0]];
    expect(statusClause).toEqual(['initiated', 'accepted']);

    const orClause = where[Object.getOwnPropertySymbols(where)[0]];
    expect(orClause).toEqual([{ callerId: ATTACKER }, { calleeId: ATTACKER }]);
  });

  it('issues a token to an actual call participant', async () => {
    CallSession.findOne.mockResolvedValue({ id: 'call-1' });

    const { res, thrown } = await runHandler(reqFor(VICTIM_CHANNEL));

    expect(thrown).toBeNull();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'REAL_TOKEN' })
    );
  });

  it('issues a token to the owner of a confirmed astrologer booking', async () => {
    AstrologerBooking.findOne.mockResolvedValue({ id: 'booking-1' });

    const { res, thrown } = await runHandler(reqFor('ast_booking-1'));

    expect(thrown).toBeNull();
    expect(res.json).toHaveBeenCalled();
    // Booking must be scoped to the caller, not just to the channel name.
    expect(AstrologerBooking.findOne.mock.calls[0][0].where.userId).toBe(ATTACKER);
  });

  it('does not let a guessed ast_<id> channel through without a booking', async () => {
    const { thrown } = await runHandler(reqFor('ast_someone-elses-booking'));
    expect(thrown).toMatchObject({ statusCode: 403 });
  });

  it('rejects a missing or oversized channel before touching the DB', async () => {
    const missing = await runHandler(reqFor(undefined));
    expect(missing.thrown).toMatchObject({ statusCode: 400 });

    const huge = await runHandler(reqFor('x'.repeat(65)));
    expect(huge.thrown).toMatchObject({ statusCode: 400 });
    expect(CallSession.findOne).not.toHaveBeenCalled();
  });

  it('authorizes before falling back to the dev stub', async () => {
    // The stub path must not become a way around the gate when Agora is unset.
    generateRtcToken.mockReturnValueOnce(null);
    const { res, thrown } = await runHandler(reqFor(VICTIM_CHANNEL));

    expect(thrown).toMatchObject({ statusCode: 403 });
    expect(res.json).not.toHaveBeenCalled();
  });
});
