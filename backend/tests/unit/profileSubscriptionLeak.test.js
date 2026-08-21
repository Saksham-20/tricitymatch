/**
 * getProfile must not disclose the target's subscription row (deep audit 2026-08-21).
 *
 * GET /profile/:userId built its query with a Subscription association nested
 * under User:
 *
 *   include: [{ model: User, ...,
 *     include: [{ model: Subscription, where: { status: 'active' }, required: false }] }]
 *
 * Nothing read it — the target's plan is re-fetched separately further down as
 * `targetSubscription` — but the handler returns `profile.toJSON()`, so Sequelize
 * serialised the whole association into the response. Every authenticated viewer
 * therefore received, for any profile they opened: planType, amount, startDate,
 * endDate, autoRenew, razorpayOrderId, razorpayPaymentId, razorpaySignature and
 * the target's remaining contact-unlock quota.
 *
 * razorpaySignature is the HMAC over `orderId|paymentId`; disclosing it beside
 * both identifiers hands out the complete verified triple.
 *
 * Also pinned here: the profile view must be recorded only AFTER the visibility
 * gate passes. The old ordering registered a visitor and then threw 403, so a
 * denied viewer still showed up in the target's "who viewed me" list.
 *
 * NOTE on the harness: asyncHandler is `Promise.resolve(fn(...)).catch(next)`
 * and does not return the promise, so assertions must drain the microtask queue
 * and inspect what `next` received rather than awaiting the handler.
 */

jest.mock('../../models', () => ({
  Profile: { findOne: jest.fn() },
  User: { findByPk: jest.fn() },
  ProfileView: { create: jest.fn() },
  Subscription: { findOne: jest.fn() },
  Match: { findOne: jest.fn() },
  ContactUnlock: { findOne: jest.fn() },
  Block: { findOne: jest.fn() },
  Verification: { findOne: jest.fn() },
}));

jest.mock('../../config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('../../middlewares/upload', () => ({ deleteFromCloudinary: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));

const {
  Profile, Match, Block, Subscription, ContactUnlock, Verification, ProfileView, User,
} = require('../../models');
const { getProfile } = require('../../controllers/profileController');

const VIEWER = 'viewer-id';
const TARGET = 'target-id';

const makeProfile = (overrides = {}) => ({
  userId: TARGET,
  profileVisibility: 'everyone',
  photoBlurUntilMatch: false,
  incognitoMode: false,
  socialMediaLinks: null,
  toJSON() { return { userId: TARGET, User: { id: TARGET, status: 'active' } }; },
  ...overrides,
});

const drain = () => new Promise((resolve) => setImmediate(resolve));

const runGetProfile = async () => {
  const req = { params: { userId: TARGET }, user: { id: VIEWER, role: 'user' } };
  const res = { json: jest.fn() };
  const next = jest.fn();
  getProfile(req, res, next);
  await drain(); await drain(); await drain();
  return { res, next };
};

describe('getProfile subscription disclosure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Block.findOne.mockResolvedValue(null);
    Match.findOne.mockResolvedValue(null);
    Subscription.findOne.mockResolvedValue(null);
    ContactUnlock.findOne.mockResolvedValue(null);
    Verification.findOne.mockResolvedValue(null);
    User.findByPk.mockResolvedValue({ phone: null, email: null });
    ProfileView.create.mockResolvedValue({});
    Profile.findOne.mockResolvedValue(makeProfile());
  });

  it('never nests a Subscription association inside the profile read', async () => {
    await runGetProfile();

    expect(Profile.findOne).toHaveBeenCalled();
    for (const [options] of Profile.findOne.mock.calls) {
      for (const inc of options?.include || []) {
        const nested = inc?.include || [];
        expect(nested.map((n) => n?.model)).not.toContain(Subscription);
      }
    }
  });

  it('does not return razorpay identifiers or unlock counters to the viewer', async () => {
    const { res } = await runGetProfile();

    expect(res.json).toHaveBeenCalled();
    const body = JSON.stringify(res.json.mock.calls[0][0]);
    expect(body).not.toMatch(/razorpaySignature/i);
    expect(body).not.toMatch(/razorpayPaymentId/i);
    expect(body).not.toMatch(/razorpayOrderId/i);
    expect(body).not.toMatch(/contactUnlocksUsed/i);
  });

  it('records the profile view only after the visibility gate passes', async () => {
    Profile.findOne.mockResolvedValue(makeProfile({ profileVisibility: 'matches_only' }));

    const { next, res } = await runGetProfile();

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    // The old ordering created the ProfileView row before throwing, so a denied
    // viewer still appeared in the target's visitor list.
    expect(ProfileView.create).not.toHaveBeenCalled();
  });
});

describe('media intro gating', () => {
  // The mobile client gates voice-intro playback in the UI (AudioIntroChip shows
  // a padlock for a free, non-mutual viewer) but the URL itself was never
  // redacted server-side, so the Cloudinary media link shipped in the JSON and
  // could be fetched with curl. A gate that exists only in the client is not a
  // gate.
  const withMedia = () => makeProfile({
    voiceIntroUrl: 'https://res.cloudinary.com/x/voice.m4a',
    videoIntroUrl: 'https://res.cloudinary.com/x/video.mp4',
    toJSON() {
      return {
        userId: TARGET,
        User: { id: TARGET, status: 'active' },
        voiceIntroUrl: 'https://res.cloudinary.com/x/voice.m4a',
        videoIntroUrl: 'https://res.cloudinary.com/x/video.mp4',
      };
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Block.findOne.mockResolvedValue(null);
    Match.findOne.mockResolvedValue(null);
    Subscription.findOne.mockResolvedValue(null);
    ContactUnlock.findOne.mockResolvedValue(null);
    Verification.findOne.mockResolvedValue(null);
    User.findByPk.mockResolvedValue({ phone: null, email: null });
    ProfileView.create.mockResolvedValue({});
    Profile.findOne.mockResolvedValue(withMedia());
  });

  it('redacts voice and video intro URLs for a free, non-mutual viewer', async () => {
    const { res } = await runGetProfile();
    const body = res.json.mock.calls[0][0];
    expect(body.profile.voiceIntroUrl).toBeNull();
    expect(body.profile.videoIntroUrl).toBeNull();
  });

  it('serves them to a viewer on a paid plan', async () => {
    Subscription.findOne.mockResolvedValue({
      planType: 'premium_plus', status: 'active',
      contactUnlocksAllowed: 15, contactUnlocksUsed: 0,
    });
    const { res } = await runGetProfile();
    const body = res.json.mock.calls[0][0];
    expect(body.profile.voiceIntroUrl).toBe('https://res.cloudinary.com/x/voice.m4a');
  });

  it('serves them to a mutual match', async () => {
    Match.findOne.mockResolvedValue({ isMutual: true, action: 'like' });
    const { res } = await runGetProfile();
    const body = res.json.mock.calls[0][0];
    expect(body.profile.voiceIntroUrl).toBe('https://res.cloudinary.com/x/voice.m4a');
  });
});
