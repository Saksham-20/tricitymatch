/** PROF-19: approving a held photo into a full gallery is refused, not silently dropped. */
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(() => Promise.resolve()) }));

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('media review decisions', (t) => {
  const ids = [];
  afterAll(async () => {
    const { MediaReview } = require('../../../models');
    if (ids.length) await MediaReview.destroy({ where: { userId: ids } });
    await removeMembers(ids);
  });

  const full = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `https://res.example/${x}.jpg`);

  t('full gallery: 409 GALLERY_FULL, review stays pending, no "live" notification', async () => {
    const { decideMediaReview } = require('../../../controllers/mediaReviewController');
    const { MediaReview } = require('../../../models');
    const { notify } = require('../../../utils/notifyUser');
    const m = await makeMember({ profile: { photos: full, profilePhoto: full[0] } });
    ids.push(m.user.id);
    const review = await MediaReview.create({ userId: m.user.id, url: 'https://res.example/held.jpg', source: 'auto' });

    const res = await call(decideMediaReview, { user: { id: m.user.id, role: 'admin' }, params: { id: review.id }, body: { decision: 'approve' } });
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('GALLERY_FULL');
    expect((await MediaReview.findByPk(review.id)).status).toBe('pending');
    expect(notify).not.toHaveBeenCalled();
  });

  t('room available: approve adds the photo', async () => {
    const { decideMediaReview } = require('../../../controllers/mediaReviewController');
    const { MediaReview, Profile } = require('../../../models');
    const m = await makeMember({ profile: { photos: full.slice(0, 2), profilePhoto: full[0] } });
    ids.push(m.user.id);
    const review = await MediaReview.create({ userId: m.user.id, url: 'https://res.example/held2.jpg', source: 'auto' });
    const res = await call(decideMediaReview, { user: { id: m.user.id, role: 'admin' }, params: { id: review.id }, body: { decision: 'approve' } });
    expect(res.statusCode).toBe(200);
    expect((await Profile.findOne({ where: { userId: m.user.id } })).photos).toContain('https://res.example/held2.jpg');
  });
});

describeDb('media review decisions: verified badge', (t) => {
  const ids = [];
  afterAll(async () => {
    const { MediaReview, Verification } = require('../../../models');
    if (ids.length) { await MediaReview.destroy({ where: { userId: ids } }); await Verification.destroy({ where: { userId: ids } }); }
    await removeMembers(ids);
  });

  t('approving a held photo that becomes the main photo withdraws the badge (PROF-20)', async () => {
    const { decideMediaReview } = require('../../../controllers/mediaReviewController');
    const { MediaReview, Verification, Profile } = require('../../../models');
    const { fingerprintOf } = require('../../../utils/verificationFingerprint');
    const m = await makeMember({ profile: { photos: [], profilePhoto: null } });
    ids.push(m.user.id);
    await Verification.create({
      userId: m.user.id, status: 'approved', selfiePhoto: 'https://res.example/s.jpg',
      approvedFingerprint: fingerprintOf(await Profile.findOne({ where: { userId: m.user.id } })),
    });
    const review = await MediaReview.create({ userId: m.user.id, url: 'https://res.example/new-main.jpg', source: 'auto', wasProfilePhoto: true });

    const res = await call(decideMediaReview, { user: { id: m.user.id, role: 'admin' }, params: { id: review.id }, body: { decision: 'approve' } });
    expect(res.statusCode).toBe(200);
    let status;
    for (let i = 0; i < 20; i += 1) {
      status = (await Verification.findOne({ where: { userId: m.user.id } })).status;
      if (status !== 'approved') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(status).toBe('pending');
  });
});
