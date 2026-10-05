/**
 * A member deleting their own photos, and the six-photo limit (owner report:
 * "deleting photos does not delete sometimes the main photo").
 *
 * - DELETE /profile/me/profile-photo spliced the gallery IN PLACE, so Sequelize
 *   saw no change and the URL stayed in `photos` after its file was deleted.
 * - DELETE /profile/me/photo 404'd for a main photo missing from the gallery.
 * - A new main photo on a full gallery silently pushed the last photo out.
 */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
const mockDelete = jest.fn(() => Promise.resolve(true));
jest.mock('../../../middlewares/upload', () => ({ deleteFromCloudinary: (...a) => mockDelete(...a) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const url = (name) => `https://res.cloudinary.com/demo/image/upload/v1/tricitymatch/profiles/${name}.jpg`;

describeDb('member photo deletion', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  beforeEach(() => mockDelete.mockClear());

  const member = async (profile) => {
    const m = await makeMember({ profile });
    ids.push(m.user.id);
    return m;
  };
  const stored = async (userId) => {
    const { Profile } = require('../../../models');
    const p = await Profile.findOne({ where: { userId }, attributes: ['photos', 'profilePhoto'] });
    return { photos: p.photos, profilePhoto: p.profilePhoto };
  };
  const deletePhoto = (user, photoUrl) => call(require('../../../controllers/profileController').deletePhoto, { user, body: { photoUrl } });
  const deleteMain = (user) => call(require('../../../controllers/profileController').deleteProfilePhoto, { user });

  t('deleting the main photo by url removes it from the gallery and promotes the next photo', async () => {
    const m = await member({ profilePhoto: url('a'), photos: [url('a'), url('b'), url('c')] });
    const res = await deletePhoto(m.user, url('a'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ photos: [url('b'), url('c')], profilePhoto: url('b') });
    expect(await stored(m.user.id)).toEqual({ photos: [url('b'), url('c')], profilePhoto: url('b') });
    expect(mockDelete).toHaveBeenCalledWith(url('a'));
  });

  t('deleting another photo leaves the main photo alone', async () => {
    const m = await member({ profilePhoto: url('b'), photos: [url('a'), url('b')] });
    expect((await deletePhoto(m.user, url('a'))).statusCode).toBe(200);
    expect(await stored(m.user.id)).toEqual({ photos: [url('b')], profilePhoto: url('b') });
  });

  t('a main photo that is not in the gallery can still be deleted, and the next one takes its place', async () => {
    const m = await member({ profilePhoto: url('legacy'), photos: [url('a'), url('b')] });
    const res = await deletePhoto(m.user, url('legacy'));
    expect(res.statusCode).toBe(200);
    expect(await stored(m.user.id)).toEqual({ photos: [url('a'), url('b')], profilePhoto: url('a') });
    expect(mockDelete).toHaveBeenCalledWith(url('legacy'));
  });

  t('an unknown url is a 404 and nothing changes', async () => {
    const m = await member({ profilePhoto: url('a'), photos: [url('a')] });
    const res = await deletePhoto(m.user, url('someone-else'));
    expect(res.statusCode).toBe(404);
    expect(await stored(m.user.id)).toEqual({ photos: [url('a')], profilePhoto: url('a') });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  t('DELETE profile-photo really takes the url out of the gallery and promotes the next photo', async () => {
    const m = await member({ profilePhoto: url('a'), photos: [url('a'), url('b')] });
    const res = await deleteMain(m.user);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ photos: [url('b')], profilePhoto: url('b') });
    expect(await stored(m.user.id)).toEqual({ photos: [url('b')], profilePhoto: url('b') });
    expect(mockDelete).toHaveBeenCalledWith(url('a'));
  });

  t('DELETE profile-photo on the only photo leaves no photo at all', async () => {
    const m = await member({ profilePhoto: url('a'), photos: [url('a')] });
    expect((await deleteMain(m.user)).statusCode).toBe(200);
    expect(await stored(m.user.id)).toEqual({ photos: [], profilePhoto: null });
  });

  t('DELETE profile-photo with no main photo is a 404', async () => {
    const m = await member({ profilePhoto: null, photos: [] });
    expect((await deleteMain(m.user)).statusCode).toBe(404);
  });

  t('the completion percentage follows the deletion', async () => {
    const { Profile } = require('../../../models');
    const m = await member({ profilePhoto: url('a'), photos: [url('a')], completionPercentage: 90 });
    await deleteMain(m.user);
    const p = await Profile.findOne({ where: { userId: m.user.id } });
    expect(p.completionPercentage).toBeLessThan(90);
  });

  t('a delete racing an upload never brings the deleted photo back', async () => {
    const { updateProfile } = require('../../../controllers/profileController');
    for (let i = 0; i < 3; i += 1) {
      const m = await member({ profilePhoto: url(`r${i}a`), photos: [url(`r${i}a`), url(`r${i}b`)] });
      const [del, up] = await Promise.all([
        deletePhoto(m.user, url(`r${i}b`)),
        call(updateProfile, { user: m.user, body: {}, files: { photos: [{ path: url(`r${i}new`) }] } }),
      ]);
      expect(del.statusCode).toBe(200);
      expect(up.statusCode).toBe(200);
      const after = await stored(m.user.id);
      expect(after.photos).not.toContain(url(`r${i}b`));
      expect(after.photos).toEqual(expect.arrayContaining([url(`r${i}a`), url(`r${i}new`)]));
    }
  });
});

describeDb('six-photo limit on upload', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  beforeEach(() => mockDelete.mockClear());

  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map(url);
  const upload = (user, files) => call(require('../../../controllers/profileController').updateProfile, { user, body: {}, files });
  const stored = async (userId) => {
    const { Profile } = require('../../../models');
    const p = await Profile.findOne({ where: { userId }, attributes: ['photos', 'profilePhoto'] });
    return { photos: p.photos, profilePhoto: p.profilePhoto };
  };

  t('a new main photo on a full gallery is refused (409) and no photo is dropped', async () => {
    const m = await makeMember({ profile: { profilePhoto: six[0], photos: six } });
    ids.push(m.user.id);
    const res = await upload(m.user, { profilePhoto: [{ path: url('new-main') }] });
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('GALLERY_FULL');
    expect(res.body.error.message).toMatch(/already have 6 photos\. Remove one first/);
    expect(await stored(m.user.id)).toEqual({ photos: six, profilePhoto: six[0] });
    // The refused upload is not left behind as a public file.
    expect(mockDelete).toHaveBeenCalledWith(url('new-main'));
    expect(mockDelete).not.toHaveBeenCalledWith(six[5]);
  });

  t('gallery uploads past the limit are refused too, with the room left in the message', async () => {
    const m = await makeMember({ profile: { profilePhoto: six[0], photos: six.slice(0, 5) } });
    ids.push(m.user.id);
    const res = await upload(m.user, { photos: [{ path: url('g1') }, { path: url('g2') }] });
    expect(res.statusCode).toBe(409);
    expect(res.body.error.message).toMatch(/add 1 more photo/);
    expect(await stored(m.user.id)).toEqual({ photos: six.slice(0, 5), profilePhoto: six[0] });
    expect(mockDelete).toHaveBeenCalledWith(url('g1'));
    expect(mockDelete).toHaveBeenCalledWith(url('g2'));
  });

  t('with room, a new main photo leads the gallery and every old photo stays', async () => {
    const m = await makeMember({ profile: { profilePhoto: six[0], photos: six.slice(0, 5) } });
    ids.push(m.user.id);
    const res = await upload(m.user, { profilePhoto: [{ path: url('new-main') }] });
    expect(res.statusCode).toBe(200);
    expect(await stored(m.user.id)).toEqual({ photos: [url('new-main'), ...six.slice(0, 5)], profilePhoto: url('new-main') });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  t('make-main only accepts a photo still in the gallery', async () => {
    const m = await makeMember({ profile: { profilePhoto: six[0], photos: six.slice(0, 2) } });
    ids.push(m.user.id);
    const { updateProfile } = require('../../../controllers/profileController');
    expect((await call(updateProfile, { user: m.user, body: { profilePhoto: six[1] } })).statusCode).toBe(200);
    expect((await stored(m.user.id)).profilePhoto).toBe(six[1]);
    expect((await call(updateProfile, { user: m.user, body: { profilePhoto: url('gone') } })).statusCode).toBe(200);
    expect((await stored(m.user.id)).profilePhoto).toBe(six[1]);
  });
});
