/** SAFE-10: staff photo removal deletes the file and re-checks the verified badge. */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
const mockDelete = jest.fn(async () => true);
jest.mock('../../../middlewares/upload', () => ({ deleteFromCloudinary: (...a) => mockDelete(...a) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('admin photo removal', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "Verifications" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
      await sequelize.query('DELETE FROM "MediaReviews" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });
  const { notify } = require('../../../utils/notifyUser');
  beforeEach(() => { mockDelete.mockClear(); notify.mockClear(); });
  const flush = () => new Promise((r) => setTimeout(r, 80));
  const remove = (staff, userId, photoUrl) => call(require('../../../controllers/adminSafetyController').removePhoto, { user: staff, body: { userId, photoUrl, reason: 'nudity' } });
  const flag = (staff, userId, photoUrl) => call(require('../../../controllers/adminSafetyController').flagPhoto, { user: staff, body: { userId, photoUrl, reason: 'review this' } });
  const setStatus = (staff, userId, status, reason) => call(require('../../../controllers/adminController').updateUserStatus, { user: staff, params: { userId }, body: { status, reason } });

  t('removing the main photo deletes the asset and sends an approved verification back to review', async () => {
    const { Verification } = require('../../../models');
    const { fingerprintOf } = require('../../../utils/verificationFingerprint');
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const m = await makeMember({ profile: { profilePhoto: 'https://img.test/main.jpg', photos: ['https://img.test/main.jpg', 'https://img.test/two.jpg'] } });
    ids.push(staff.id, m.user.id);
    await Verification.create({
      userId: m.user.id, status: 'approved', verifiedAt: new Date(),
      approvedFingerprint: fingerprintOf(m.profile),
    });

    const res = await remove(staff, m.user.id, 'https://img.test/main.jpg');
    expect(res.statusCode).toBe(200);
    await flush();
    expect(mockDelete).toHaveBeenCalledWith('https://img.test/main.jpg');
    // The member must actually be notified — the type MUST be a valid Notification
    // ENUM value ('photo_removed' is not one and threw silently before).
    expect(notify).toHaveBeenCalledWith(m.user.id, 'system', expect.any(String), expect.any(String));
    const v = await Verification.findOne({ where: { userId: m.user.id } });
    expect(v.status).toBe('pending');
    expect(v.approvedFingerprint).toBeNull();
  });

  t('removing a non-main photo deletes the asset but leaves the badge alone', async () => {
    const { Verification } = require('../../../models');
    const { fingerprintOf } = require('../../../utils/verificationFingerprint');
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const m = await makeMember({ profile: { profilePhoto: 'https://img.test/main.jpg', photos: ['https://img.test/main.jpg', 'https://img.test/two.jpg'] } });
    ids.push(staff.id, m.user.id);
    await Verification.create({ userId: m.user.id, status: 'approved', verifiedAt: new Date(), approvedFingerprint: fingerprintOf(m.profile) });

    const res = await remove(staff, m.user.id, 'https://img.test/two.jpg');
    expect(res.statusCode).toBe(200);
    await flush();
    expect(mockDelete).toHaveBeenCalledWith('https://img.test/two.jpg');
    expect((await Verification.findOne({ where: { userId: m.user.id } })).status).toBe('approved');
  });

  t('flagging a photo files a pending admin MediaReview without deleting the asset, and is idempotent', async () => {
    const { MediaReview } = require('../../../models');
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const m = await makeMember({ profile: { profilePhoto: 'https://img.test/m.jpg', photos: ['https://img.test/m.jpg', 'https://img.test/g.jpg'] } });
    ids.push(staff.id, m.user.id);

    const res = await flag(staff, m.user.id, 'https://img.test/g.jpg');
    expect(res.statusCode).toBe(200);
    expect(mockDelete).not.toHaveBeenCalled(); // flag keeps the photo live
    const rows = await MediaReview.findAll({ where: { userId: m.user.id, url: 'https://img.test/g.jpg' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].source).toBe('admin');

    // Second flag on the same open photo does not pile up a duplicate row.
    const again = await flag(staff, m.user.id, 'https://img.test/g.jpg');
    expect(again.statusCode).toBe(200);
    expect(again.body.alreadyFlagged).toBe(true);
    expect(await MediaReview.count({ where: { userId: m.user.id, url: 'https://img.test/g.jpg', status: 'pending' } })).toBe(1);
  });

  t('flagging a photo that is not on the profile is a 404', async () => {
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const m = await makeMember({ profile: { profilePhoto: 'https://img.test/only.jpg', photos: ['https://img.test/only.jpg'] } });
    ids.push(staff.id, m.user.id);
    const res = await flag(staff, m.user.id, 'https://img.test/not-theirs.jpg');
    expect(res.statusCode).toBe(404);
  });

  t('banning a member records the reason and notifies them; reinstating notifies too', async () => {
    const { User } = require('../../../models');
    const staff = (await makeMember({ user: { role: 'admin' } })).user;
    const m = await makeMember({ user: { status: 'active' } });
    ids.push(staff.id, m.user.id);

    const banned = await setStatus(staff, m.user.id, 'banned', 'inappropriate photos');
    expect(banned.statusCode).toBe(200);
    expect((await User.findByPk(m.user.id)).status).toBe('banned');
    expect(notify).toHaveBeenCalledWith(m.user.id, 'system', expect.any(String), expect.stringContaining('inappropriate photos'));

    notify.mockClear();
    const back = await setStatus(staff, m.user.id, 'active', '');
    expect(back.statusCode).toBe(200);
    expect((await User.findByPk(m.user.id)).status).toBe('active');
    expect(notify).toHaveBeenCalledWith(m.user.id, 'system', expect.stringContaining('restored'), expect.any(String));
  });
});
