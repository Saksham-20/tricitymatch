/** SAFE-10: staff photo removal deletes the file and re-checks the verified badge. */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
const mockDelete = jest.fn(async () => true);
jest.mock('../../../middlewares/upload', () => ({ deleteFromCloudinary: (...a) => mockDelete(...a) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('admin photo removal', (t) => {
  const ids = [];
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Verifications" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });
  beforeEach(() => mockDelete.mockClear());
  const flush = () => new Promise((r) => setTimeout(r, 80));
  const remove = (staff, userId, photoUrl) => call(require('../../../controllers/adminSafetyController').removePhoto, { user: staff, body: { userId, photoUrl, reason: 'nudity' } });

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
});
