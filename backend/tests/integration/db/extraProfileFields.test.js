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

  t('a phone number hidden in the bio or a prompt answer is refused and nothing is saved', async () => {
    const { updateProfile } = require('../../../controllers/profileController');
    const { Profile } = require('../../../models');
    const owner = await makeMember({ profile: { bio: 'Family-first, love cricket.' } });
    ids.push(owner.user.id);

    const split = await call(updateProfile, { user: owner.user, body: { bio: 'Hello 97410, 79680 nice to meet you', city: 'Mohali' } });
    expect(split.statusCode).toBe(400);
    expect(split.body.error.code).toBe('CONTACT_IN_TEXT');
    const prompt = await call(updateProfile, { user: owner.user, body: { profilePrompts: JSON.stringify([{ question: 'q', answer: 'whatsapp me on 98765 43210' }]) } });
    expect(prompt.statusCode).toBe(400);

    const row = await Profile.findOne({ where: { userId: owner.user.id } });
    expect(row.bio).toBe('Family-first, love cricket.');
    expect(row.city).not.toBe('Mohali');

    const fine = await call(updateProfile, { user: owner.user, body: { bio: 'Born 1995, 5 10, earning 8,00,000 - 9,00,000.' } });
    expect(fine.statusCode).toBe(200);
  });

  t('every text field is screened; Spotify must be Spotify; social links never carry a number', async () => {
    const { updateProfile } = require('../../../controllers/profileController');
    const owner = await makeMember();
    ids.push(owner.user.id);
    for (const body of [
      { placeOfBirth: 'Ludhiana, ring 98765 43210' },
      { fatherOccupation: 'Business, insta: shop_k' },
      { interestTags: ['cricket', 'priya.k@gmail.com'] },
      { subCaste: 'see www.example.in' },
    ]) {
      const res = await call(updateProfile, { user: owner.user, body });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('CONTACT_IN_TEXT');
    }
    expect((await call(updateProfile, { user: owner.user, body: { spotifyPlaylist: 'https://evil.example/x' } })).statusCode).toBe(400);
    expect((await call(updateProfile, { user: owner.user, body: { spotifyPlaylist: 'https://open.spotify.com/playlist/abc' } })).statusCode).toBe(200);
    expect((await call(updateProfile, { user: owner.user, body: { socialMediaLinks: { website: { url: 'https://wa.me/919876543210', visibility: 'matches_only' } } } })).statusCode).toBe(400);
    expect((await call(updateProfile, { user: owner.user, body: { degree: 'B.Com, M.Com' } })).statusCode).toBe(200);
  });

  t('text saved before the rule is masked for other members, not for the owner; links stay matches-only', async () => {
    const { getProfile, getMyProfile } = require('../../../controllers/profileController');
    const { Profile } = require('../../../models');
    const owner = await makeMember({ profile: { gender: 'female' } });
    const viewer = await makeMember({ profile: { gender: 'male' } });
    ids.push(owner.user.id, viewer.user.id);
    await Profile.update({
      bio: 'Hello 97410, 79680 it is a pleasure',
      socialMediaLinks: { instagram: { url: 'https://instagram.com/x', visibility: 'everyone' } },
    }, { where: { userId: owner.user.id }, hooks: false });

    const seen = await call(getProfile, { user: viewer.user, params: { userId: owner.user.id } });
    expect(seen.statusCode).toBe(200);
    expect(seen.body.profile.bio).toBe('Hello [hidden] it is a pleasure');
    expect(seen.body.profile.socialMediaLinks).toBeNull();

    if (getMyProfile) {
      const mine = await call(getMyProfile, { user: owner.user });
      expect(mine.body.profile.bio).toContain('97410');
    }
  });
});

