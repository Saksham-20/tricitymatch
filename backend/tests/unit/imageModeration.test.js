/**
 * P1-6: automated screening holds flagged photos for a human; a provider outage
 * never blocks an upload; staff decisions move a held photo live or delete it.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

let mockProvider = 'stub';
jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return {
    ...actual,
    get moderation() { return { provider: mockProvider }; },
    upload: { ...actual.upload, maxGalleryPhotos: 3 },
  };
});

const mod = require('../../utils/imageModeration');

const fakeModel = () => {
  const rows = [];
  return { rows, create: jest.fn(async (r) => { rows.push(r); return r; }) };
};

describe('holdFlaggedPhotos', () => {
  beforeEach(() => { mockProvider = 'stub'; });

  it('holds a flagged photo and opens a review; clean photos are untouched', async () => {
    const MediaReview = fakeModel();
    const out = await mod.holdFlaggedPhotos({
      userId: 'u1',
      newUrls: ['https://x/ok.jpg', 'https://x/flag-test-1.jpg'],
      profilePhoto: 'https://x/flag-test-1.jpg',
      MediaReview,
    });
    expect(out.held).toEqual(['https://x/flag-test-1.jpg']);
    expect(MediaReview.rows).toHaveLength(1);
    expect(MediaReview.rows[0]).toMatchObject({
      userId: 'u1', source: 'auto', status: 'pending', provider: 'stub',
      wasProfilePhoto: true, labels: ['stub:flagged'],
    });
  });

  it('screens nothing when the provider is off', async () => {
    mockProvider = 'off';
    const MediaReview = fakeModel();
    const out = await mod.holdFlaggedPhotos({ userId: 'u1', newUrls: ['https://x/flag-test.jpg'], profilePhoto: null, MediaReview });
    expect(out.held).toEqual([]);
    expect(MediaReview.create).not.toHaveBeenCalled();
  });

  it('an unknown provider name behaves as off', async () => {
    mockProvider = 'nonsense';
    expect(mod.providerName()).toBe('off');
  });

  it('fails OPEN: a provider error does not hold or block the photo', async () => {
    const original = mod.providers.stub;
    mod.providers.stub = async () => { throw new Error('provider down'); };
    try {
      const MediaReview = fakeModel();
      const out = await mod.holdFlaggedPhotos({ userId: 'u1', newUrls: ['https://x/a.jpg'], profilePhoto: null, MediaReview });
      expect(out.held).toEqual([]);
      expect(MediaReview.create).not.toHaveBeenCalled();
    } finally {
      mod.providers.stub = original;
    }
  });

  it('does nothing when there are no new photos', async () => {
    const MediaReview = fakeModel();
    const out = await mod.holdFlaggedPhotos({ userId: 'u1', newUrls: [], profilePhoto: null, MediaReview });
    expect(out.held).toEqual([]);
  });
});

describe('decideMediaReview', () => {
  const load = ({ review, profile }) => {
    jest.resetModules();
    const state = { review, profile, deleted: [], notified: [] };
    jest.doMock('../../models', () => ({
      Profile: { findOne: jest.fn(async () => state.profile), findAll: jest.fn(async () => []) },
      MediaReview: { findByPk: jest.fn(async () => state.review), findAll: jest.fn(async () => []) },
    }));
    jest.doMock('../../config/database', () => ({
      transaction: async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }),
    }));
    jest.doMock('../../middlewares/upload', () => ({
      deleteFromCloudinary: jest.fn(async (u) => { state.deleted.push(u); }),
    }));
    jest.doMock('../../utils/notifyUser', () => ({
      notify: jest.fn(async (...a) => { state.notified.push(a); }),
    }));
    const ctl = require('../../controllers/mediaReviewController');
    return { ctl, state };
  };

  const call = async (ctl, body) => {
    const res = { json: jest.fn() };
    const next = jest.fn();
    await ctl.decideMediaReview({ params: { id: 'r1' }, body, user: { id: 'admin1' } }, res, next);
    await new Promise((r) => setImmediate(r));
    return { res, next };
  };

  const mkReview = (over = {}) => ({
    id: 'r1', userId: 'u1', url: 'https://x/held.jpg', source: 'auto', status: 'pending', wasProfilePhoto: true,
    save: jest.fn(async () => {}), toJSON() { return this; }, ...over,
  });
  const mkProfile = (over = {}) => ({ photos: ['https://x/a.jpg'], profilePhoto: 'https://x/a.jpg', save: jest.fn(async () => {}), ...over });

  it('approving a held photo puts it on the profile (and as main photo if it was)', async () => {
    const review = mkReview();
    const profile = mkProfile();
    const { ctl, state } = load({ review, profile });
    await call(ctl, { decision: 'approve' });
    expect(profile.photos).toEqual(['https://x/a.jpg', 'https://x/held.jpg']);
    expect(profile.profilePhoto).toBe('https://x/held.jpg');
    expect(review.status).toBe('approved');
    expect(review.decidedBy).toBe('admin1');
    expect(state.deleted).toEqual([]);
    expect(state.notified[0][2]).toBe('Your photo is live');
  });

  it('approving does not exceed the gallery cap', async () => {
    const review = mkReview({ wasProfilePhoto: false });
    const profile = mkProfile({ photos: ['a', 'b', 'c'] });
    const { ctl } = load({ review, profile });
    await call(ctl, { decision: 'approve' });
    expect(profile.photos).toEqual(['a', 'b', 'c']);
    expect(review.status).toBe('approved');
  });

  it('rejecting a held photo deletes the asset and tells the member', async () => {
    const review = mkReview();
    const profile = mkProfile();
    const { ctl, state } = load({ review, profile });
    await call(ctl, { decision: 'reject', note: 'Not a photo of you' });
    expect(review.status).toBe('rejected');
    expect(state.deleted).toEqual(['https://x/held.jpg']);
    expect(profile.photos).toEqual(['https://x/a.jpg']);
    expect(state.notified[0][3]).toContain('Not a photo of you');
  });

  it('rejecting a REPORTED photo removes it from the profile and picks a new main photo', async () => {
    const review = mkReview({ source: 'report', url: 'https://x/stolen.jpg' });
    const profile = mkProfile({ photos: ['https://x/stolen.jpg', 'https://x/b.jpg'], profilePhoto: 'https://x/stolen.jpg' });
    const { ctl, state } = load({ review, profile });
    await call(ctl, { decision: 'reject', note: 'Taken from another person' });
    expect(profile.photos).toEqual(['https://x/b.jpg']);
    expect(profile.profilePhoto).toBe('https://x/b.jpg');
    expect(state.deleted).toEqual(['https://x/stolen.jpg']);
  });

  it('approving a REPORTED photo leaves the profile alone', async () => {
    const review = mkReview({ source: 'report', url: 'https://x/a.jpg' });
    const profile = mkProfile();
    const { ctl } = load({ review, profile });
    await call(ctl, { decision: 'approve' });
    expect(profile.save).not.toHaveBeenCalled();
    expect(review.status).toBe('approved');
  });

  it('a second decision on the same review is refused', async () => {
    const review = mkReview({ status: 'approved' });
    const { ctl } = load({ review, profile: mkProfile() });
    const { next } = await call(ctl, { decision: 'reject' });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });
});
