/**
 * "Hide my photos until we match" (Settings → Privacy).
 *
 * The column `Profiles.photoBlurUntilMatch` and its enforcement already existed
 * (utils/profileVisibility withholds profilePhoto/photos from any viewer who is
 * not a mutual match), but no screen could switch it on, so the Privacy Policy,
 * Help and the dashboard promised a control that did not exist. This pins:
 *   1. PUT /profile/privacy accepts the boolean (and nothing else) and echoes it;
 *   2. the "Sent" list no longer hands the sender a liked PHOTO's URL once the
 *      other member hides their photos (the note and the "it was a photo" fact
 *      stay; a mutual match still sees it, as everywhere else).
 *
 * asyncHandler does not return its promise, so each case drains the event loop
 * and reads what `res.json`/`next` received.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../models', () => ({
  Profile: { findOne: jest.fn() },
  User: { findByPk: jest.fn() },
  ProfileView: { create: jest.fn() },
  Subscription: { findOne: jest.fn() },
  Match: { findOne: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn() },
  ContactUnlock: { findOne: jest.fn() },
  Block: { findOne: jest.fn(), findAll: jest.fn() },
  Verification: { findOne: jest.fn() },
}));
jest.mock('../../config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('../../middlewares/upload', () => ({ deleteFromCloudinary: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/profileVisibility', () => {
  const actual = jest.requireActual('../../utils/profileVisibility');
  return {
    ...actual,
    loadViewerContext: jest.fn(),
    viewerHasPaidAccess: jest.fn(),
    matchesOnlyClause: jest.fn(() => ({})),
  };
});

const { Profile, Match } = require('../../models');
const { loadViewerContext, viewerHasPaidAccess } = require('../../utils/profileVisibility');
const { updatePrivacySettings } = require('../../controllers/profileController');
const { getSentInterests } = require('../../controllers/matchController');

const drain = () => new Promise((resolve) => setImmediate(resolve));

const run = async (handler, req) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  handler(req, res, next);
  await drain();
  await drain();
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe('PUT /profile/privacy — photoBlurUntilMatch', () => {
  const ownProfile = (overrides = {}) => ({
    profileVisibility: 'everyone',
    showOnlineStatus: true,
    showLastSeen: true,
    incognitoMode: false,
    photoBlurUntilMatch: false,
    fieldVisibility: {},
    save: jest.fn(async () => {}),
    ...overrides,
  });

  it('switches it on and echoes the saved value', async () => {
    const profile = ownProfile();
    Profile.findOne.mockResolvedValue(profile);

    const { res, next } = await run(updatePrivacySettings, { user: { id: 'me' }, body: { photoBlurUntilMatch: true } });

    expect(next).not.toHaveBeenCalled();
    expect(profile.photoBlurUntilMatch).toBe(true);
    expect(profile.save).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].profile.photoBlurUntilMatch).toBe(true);
  });

  it('switches it off again', async () => {
    const profile = ownProfile({ photoBlurUntilMatch: true });
    Profile.findOne.mockResolvedValue(profile);

    const { res } = await run(updatePrivacySettings, { user: { id: 'me' }, body: { photoBlurUntilMatch: false } });

    expect(profile.photoBlurUntilMatch).toBe(false);
    expect(res.json.mock.calls[0][0].profile.photoBlurUntilMatch).toBe(false);
  });

  it('ignores a value that is not a boolean, like the other privacy switches', async () => {
    const profile = ownProfile({ photoBlurUntilMatch: false });
    Profile.findOne.mockResolvedValue(profile);

    await run(updatePrivacySettings, { user: { id: 'me' }, body: { photoBlurUntilMatch: 'yes' } });

    expect(profile.photoBlurUntilMatch).toBe(false);
  });

  it('leaves the setting alone when another switch is saved', async () => {
    const profile = ownProfile({ photoBlurUntilMatch: true });
    Profile.findOne.mockResolvedValue(profile);

    await run(updatePrivacySettings, { user: { id: 'me' }, body: { incognitoMode: true } });

    expect(profile.photoBlurUntilMatch).toBe(true);
    expect(profile.incognitoMode).toBe(true);
  });
});

describe('GET /match/sent — a liked photo of someone who hides their photos', () => {
  const ME = 'me-id';
  const THEM = 'them-id';
  const PHOTO = 'https://res.cloudinary.com/x/them-1.jpg';

  const sentRow = ({ hides, likedItem, note = 'Lovely smile' }) => ({
    matchedUserId: THEM,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    compatibilityScore: 80,
    isMutual: false,
    note,
    likedItem,
    MatchedUser: {
      Profile: {
        photoBlurUntilMatch: hides,
        toJSON() {
          return {
            firstName: 'Asha', lastName: 'K', city: 'Mohali',
            profilePhoto: PHOTO, photos: [PHOTO], photoBlurUntilMatch: hides,
          };
        },
      },
    },
  });

  const listSent = async ({ hides, mutual, likedItem }) => {
    loadViewerContext.mockResolvedValue({ blockedIds: [], mutualIds: new Set(mutual ? [THEM] : []) });
    viewerHasPaidAccess.mockResolvedValue(false);
    Match.findAndCountAll.mockResolvedValue({ count: 1, rows: [sentRow({ hides, likedItem })] });
    const { res, next } = await run(getSentInterests, { user: { id: ME }, query: {} });
    expect(next).not.toHaveBeenCalled();
    return res.json.mock.calls[0][0].sent[0];
  };

  it('withholds the photo URL from the sender, but keeps the note and the kind', async () => {
    const item = await listSent({ hides: true, mutual: false, likedItem: { type: 'photo', photoUrl: PHOTO } });
    expect(item.likedItem).toEqual({ type: 'photo' });
    expect(item.note).toBe('Lovely smile');
    expect(item.profilePhoto).toBeNull();
    expect(item.photos).toEqual([]);
    expect(JSON.stringify(item)).not.toContain(PHOTO);
  });

  it('still shows it to a mutual match', async () => {
    const item = await listSent({ hides: true, mutual: true, likedItem: { type: 'photo', photoUrl: PHOTO } });
    expect(item.likedItem).toEqual({ type: 'photo', photoUrl: PHOTO });
    expect(item.profilePhoto).toBe(PHOTO);
  });

  it('is unchanged when the member does not hide their photos', async () => {
    const item = await listSent({ hides: false, mutual: false, likedItem: { type: 'photo', photoUrl: PHOTO } });
    expect(item.likedItem).toEqual({ type: 'photo', photoUrl: PHOTO });
  });

  it('keeps a liked prompt (no photo in it)', async () => {
    const likedItem = { type: 'prompt', promptText: 'Sunday plans: chai and old songs' };
    const item = await listSent({ hides: true, mutual: false, likedItem });
    expect(item.likedItem).toEqual(likedItem);
  });
});
