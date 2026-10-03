/**
 * "Exclude my own gotra", both directions, in search, daily matches and the
 * profile page note. Four public pages promise this; nothing implemented it.
 */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('same-gotra exclusion', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const tag = () => `Gt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mk = async (profile) => { const m = await makeMember({ profile }); ids.push(m.user.id); return m; };
  const search = async (viewer, city) => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const res = await call(searchProfiles, { user: viewer.user, query: { city, limit: '50' } });
    expect(res.statusCode).toBe(200);
    return res.body.profiles.map((p) => p.userId);
  };

  t('default: nothing is hidden, even with identical gotras', async () => {
    const city = tag();
    const viewer = await mk({ gender: 'male', gotra: 'Kashyap' });
    const same = await mk({ gender: 'female', city, gotra: 'Kashyap' });
    expect(await search(viewer, city)).toContain(same.user.id);
  });

  t('viewer asks to avoid their gotra: same gotra is hidden however it was typed, others and unknowns stay', async () => {
    const city = tag();
    const viewer = await mk({ gender: 'male', gotra: 'Kashyap', excludeSameGotra: true });
    const same = await mk({ gender: 'female', city, gotra: 'kashyap gotra' });
    const other = await mk({ gender: 'female', city, gotra: 'Vashishth' });
    const unknown = await mk({ gender: 'female', city, gotra: null });
    const found = await search(viewer, city);
    expect(found).not.toContain(same.user.id);
    expect(found).toEqual(expect.arrayContaining([other.user.id, unknown.user.id]));
  });

  t('the OTHER member asked to avoid their gotra: the viewer is hidden from them, and they from the viewer\'s results', async () => {
    const city = tag();
    const viewer = await mk({ gender: 'male', gotra: 'Kashyap' }); // viewer set nothing
    const picky = await mk({ gender: 'female', city, gotra: 'Kashyap', excludeSameGotra: true });
    const easy = await mk({ gender: 'female', city, gotra: 'Kashyap' });
    const found = await search(viewer, city);
    expect(found).not.toContain(picky.user.id);
    expect(found).toContain(easy.user.id);
    // and from the picky member's side
    const pickyCity = tag();
    const m = await mk({ gender: 'male', city: pickyCity, gotra: 'Kashyap' });
    expect(await search(picky, pickyCity)).not.toContain(m.user.id);
  });

  t('a viewer with no gotra recorded is never filtered, and never filters', async () => {
    const city = tag();
    const viewer = await mk({ gender: 'male', gotra: null, excludeSameGotra: true });
    const picky = await mk({ gender: 'female', city, gotra: 'Kashyap', excludeSameGotra: true });
    expect(await search(viewer, city)).toContain(picky.user.id);
  });

  t('looking someone up by profile code is a direct lookup and is not filtered', async () => {
    const { getProfileByCode } = require('../../../controllers/searchController');
    const { toProfileCode } = require('../../../utils/profileCode');
    const viewer = await mk({ gender: 'male', gotra: 'Kashyap', excludeSameGotra: true });
    const same = await mk({ gender: 'female', gotra: 'Kashyap' });
    const res = await call(getProfileByCode, { user: viewer.user, query: { code: toProfileCode(same.user.id) } });
    expect(res.statusCode).toBe(200);
  });

  t('the profile page flags a shared gotra and nothing else', async () => {
    const { getProfile } = require('../../../controllers/profileController');
    const viewer = await mk({ gender: 'male', gotra: 'Kashyap' });
    const same = await mk({ gender: 'female', gotra: 'Kashyap Gotra' });
    const other = await mk({ gender: 'female', gotra: 'Vashishth' });
    expect((await call(getProfile, { user: viewer.user, params: { userId: same.user.id } })).body.sameGotra).toBe(true);
    expect((await call(getProfile, { user: viewer.user, params: { userId: other.user.id } })).body.sameGotra).toBe(false);
  });

  t('the setting is private and saves through the profile update', async () => {
    const { updateProfile, getProfile } = require('../../../controllers/profileController');
    const me = await mk({ gender: 'male', gotra: 'Kashyap' });
    const other = await mk({ gender: 'female' });
    const saved = await call(updateProfile, { user: me.user, body: { excludeSameGotra: 'true' } });
    expect(saved.statusCode).toBe(200);
    expect(saved.body.profile.excludeSameGotra).toBe(true);
    const seen = await call(getProfile, { user: other.user, params: { userId: me.user.id } });
    expect(seen.body.profile).not.toHaveProperty('excludeSameGotra');
  });
});
