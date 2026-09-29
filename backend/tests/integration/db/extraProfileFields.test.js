/**
 * The extra profile fields (audit P2): stored, cleared with '', validated.
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('extra profile fields', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('updateProfile stores the new fields and getProfile returns them to a viewer', async () => {
    const { updateProfile, getProfile } = require('../../../controllers/profileController');
    const owner = await makeMember();
    const viewer = await makeMember();
    ids.push(owner.user.id, viewer.user.id);

    const saved = await call(updateProfile, { user: owner.user, body: {
      nationality: '<b>Indian</b>', willingToRelocate: 'maybe', livingArrangement: 'with_family',
      familyValues: 'moderate', institution: 'Panjab University', industry: 'Healthcare', brothers: 1, sisters: 2,
    } });
    expect(saved.statusCode).toBe(200);

    const seen = await call(getProfile, { user: viewer.user, params: { userId: owner.user.id } });
    expect(seen.body.profile).toMatchObject({
      nationality: 'Indian', willingToRelocate: 'maybe', livingArrangement: 'with_family',
      familyValues: 'moderate', institution: 'Panjab University', industry: 'Healthcare', brothers: 1, sisters: 2,
    });

    // '' from a form clears them
    const cleared = await call(updateProfile, { user: owner.user, body: { willingToRelocate: '', brothers: '', familyValues: '' } });
    expect(cleared.statusCode).toBe(200);
    const { Profile } = require('../../../models');
    const p = await Profile.findOne({ where: { userId: owner.user.id } });
    expect(p.willingToRelocate).toBeNull();
    expect(p.brothers).toBeNull();
    expect(p.familyValues).toBeNull();
    expect(p.sisters).toBe(2);
  });

  t('the validator rejects values outside the allowed sets', async () => {
    const { validationResult } = require('express-validator');
    const { updateProfileValidation } = require('../../../validators');
    const run = async (body) => {
      const req = { body, headers: {}, query: {}, params: {} };
      for (const rule of updateProfileValidation) {
        if (typeof rule.run === 'function') await rule.run(req);
      }
      return validationResult(req).array().map((e) => e.path || e.param);
    };
    expect(await run({ willingToRelocate: 'sometimes' })).toContain('willingToRelocate');
    expect(await run({ familyValues: 'strict' })).toContain('familyValues');
    expect(await run({ livingArrangement: 'boat' })).toContain('livingArrangement');
    expect(await run({ brothers: 99 })).toContain('brothers');
    expect(await run({ willingToRelocate: 'yes', familyValues: 'liberal', livingArrangement: 'alone', brothers: 2 })).toEqual([]);
  });
});
