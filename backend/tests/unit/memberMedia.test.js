/**
 * Destroying a member's uploaded media (platform audit 2026-09-29, P0-7).
 *
 * Erasure removed the database rows but never the files, so photos, the
 * verification selfie, voice and video stayed on public URLs after "delete".
 */

const fs = require('fs/promises');
const { collectMemberMedia, destroyMedia } = require('../../utils/memberMedia');

const IMG = 'https://res.cloudinary.com/demo/image/upload/v1/profile-photos/a.jpg';
const IMG2 = 'https://res.cloudinary.com/demo/image/upload/v1/gallery/b.jpg';
const VID = 'https://res.cloudinary.com/demo/video/upload/v1/voice-intros/c.mp3';
const HELD = 'https://res.cloudinary.com/demo/image/upload/v1/gallery/held.jpg';

const fakeCloudinary = (impl) => ({ uploader: { destroy: jest.fn(impl || (async () => ({ result: 'ok' }))) } });
const deps = (cloudinary, extra = {}) => ({ cloudinary, isConfigured: true, retryDelayMs: 0, ...extra });

describe('collectMemberMedia', () => {
  it('gathers profile, gallery, intro, selfie, liveness and voice-message URLs, de-duplicated', async () => {
    const sequelize = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ profilePhoto: IMG, photos: [IMG, IMG2], voiceIntroUrl: VID, videoIntroUrl: null }], {}])
        .mockResolvedValueOnce([[{ selfiePhoto: 'https://res.cloudinary.com/demo/image/upload/v1/verification-docs/s.jpg', selfieVideoUrl: null, documentFront: null, documentBack: null }], {}])
        // photos held for moderation review are no longer on the profile
        .mockResolvedValueOnce([[{ url: HELD }], {}])
        .mockResolvedValueOnce([[{ mediaUrl: 'https://res.cloudinary.com/demo/video/upload/v1/voice-messages/m.webm' }], {}]),
    };
    const urls = await collectMemberMedia(sequelize, ['u1']);
    expect(urls.sort()).toEqual([
      HELD,
      'https://res.cloudinary.com/demo/image/upload/v1/verification-docs/s.jpg',
      'https://res.cloudinary.com/demo/video/upload/v1/voice-messages/m.webm',
      IMG2, IMG, VID,
    ].sort());
  });

  it('reads gallery photos stored as a JSON string', async () => {
    const sequelize = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ profilePhoto: null, photos: JSON.stringify([IMG2]), voiceIntroUrl: null, videoIntroUrl: null }], {}])
        .mockResolvedValue([[], {}]),
    };
    expect(await collectMemberMedia(sequelize, ['u1'])).toEqual([IMG2]);
  });

  it('does not query at all for no members', async () => {
    const sequelize = { query: jest.fn() };
    expect(await collectMemberMedia(sequelize, [])).toEqual([]);
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});

describe('destroyMedia', () => {
  it('destroys each asset with the resource_type taken from its URL (video is not an image)', async () => {
    const cloudinary = fakeCloudinary();
    const summary = await destroyMedia([IMG, VID], deps(cloudinary));

    expect(summary.deleted).toBe(2);
    const calls = Object.fromEntries(cloudinary.uploader.destroy.mock.calls.map(([id, opts]) => [id, opts]));
    expect(calls['profile-photos/a']).toMatchObject({ resource_type: 'image', invalidate: true });
    expect(calls['voice-intros/c']).toMatchObject({ resource_type: 'video', invalidate: true });
  });

  it('counts an already-missing asset as gone, not as a failure', async () => {
    const summary = await destroyMedia([IMG], deps(fakeCloudinary(async () => ({ result: 'not found' }))));
    expect(summary).toMatchObject({ deleted: 0, alreadyGone: 1, failed: [] });
  });

  it('retries a transient error and then succeeds', async () => {
    let n = 0;
    const cloudinary = fakeCloudinary(async () => { n += 1; if (n < 3) throw new Error('timeout'); return { result: 'ok' }; });
    const summary = await destroyMedia([IMG], deps(cloudinary));
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
    expect(summary.deleted).toBe(1);
    expect(summary.failed).toEqual([]);
  });

  it('reports a persistent failure by public_id instead of throwing, and keeps going', async () => {
    const cloudinary = fakeCloudinary(async (id) => {
      if (id === 'profile-photos/a') throw new Error('cloudinary down');
      return { result: 'ok' };
    });
    const summary = await destroyMedia([IMG, IMG2], deps(cloudinary));
    expect(summary.deleted).toBe(1);
    expect(summary.failed).toEqual([{ publicId: 'profile-photos/a', resourceType: 'image', error: 'cloudinary down' }]);
  });

  it('treats an unexpected Cloudinary answer as a failure worth retrying', async () => {
    const summary = await destroyMedia([IMG], deps(fakeCloudinary(async () => ({ result: 'error' }))));
    expect(summary.failed).toHaveLength(1);
  });

  it('skips URLs it does not own (external hosts) without calling Cloudinary', async () => {
    const cloudinary = fakeCloudinary();
    const summary = await destroyMedia(['https://example.com/x.jpg', 'junk'], deps(cloudinary));
    expect(summary.skipped).toBe(2);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('does nothing (and does not throw) when Cloudinary is not configured', async () => {
    const cloudinary = fakeCloudinary();
    const summary = await destroyMedia([IMG], deps(cloudinary, { isConfigured: false }));
    expect(summary.skipped).toBe(1);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('never deletes outside the uploads directory, whatever the stored value says', async () => {
    const unlink = jest.spyOn(fs, 'unlink').mockResolvedValue();
    const summary = await destroyMedia(['/uploads/../server.js', '/uploads/a/../../server.js'], deps(fakeCloudinary()));
    expect(unlink).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(2);
    unlink.mockRestore();
  });

  it('removes a local fallback file, and treats a missing one as already gone', async () => {
    const unlink = jest.spyOn(fs, 'unlink')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'ENOENT' }));
    const summary = await destroyMedia(['/uploads/photos/a.jpg', '/uploads/photos/b.jpg'], deps(fakeCloudinary()));
    expect(summary).toMatchObject({ local: 1, alreadyGone: 1, failed: [] });
    unlink.mockRestore();
  });

  it('returns an empty summary for no URLs', async () => {
    expect(await destroyMedia([], deps(fakeCloudinary()))).toMatchObject({ deleted: 0, failed: [] });
  });
});
