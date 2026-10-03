/**
 * PROF-10: a member cannot clear a staff flag by resubmitting a selfie.
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('verification resubmission', (t) => {
  const ids = [];
  afterAll(async () => {
    const { Verification } = require('../../../models');
    if (ids.length) await Verification.destroy({ where: { userId: ids } });
    await removeMembers(ids);
  });

  const submit = (user) => {
    const { submitVerification } = require('../../../controllers/verificationController');
    return new Promise((resolve) => {
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; resolve(this); return this; } };
      submitVerification({ user: { id: user.id }, files: { selfiePhoto: [{ path: 'https://res.example/selfie.jpg' }] }, body: {} }, res,
        (err) => { res.statusCode = err.statusCode; res.body = { error: err }; resolve(res); });
    });
  };

  t('flagged: resubmission is refused and the flag stays', async () => {
    const { Verification } = require('../../../models');
    const m = await makeMember(); ids.push(m.user.id);
    await Verification.create({ userId: m.user.id, status: 'flagged', adminNotes: 'Photo looks edited', selfiePhoto: 'https://res.example/old.jpg' });
    const res = await submit(m.user);
    expect(res.statusCode).toBe(409);
    const row = await Verification.findOne({ where: { userId: m.user.id } });
    expect(row.status).toBe('flagged');
    expect(row.adminNotes).toBe('Photo looks edited');
  });

  t('rejected: resubmission still works', async () => {
    const { Verification } = require('../../../models');
    const m = await makeMember(); ids.push(m.user.id);
    await Verification.create({ userId: m.user.id, status: 'rejected', adminNotes: 'Blurry', selfiePhoto: 'https://res.example/old.jpg' });
    const res = await submit(m.user);
    expect(res.statusCode).toBe(200);
    const row = await Verification.findOne({ where: { userId: m.user.id } });
    expect(row.status).toBe('pending');
  });
});
