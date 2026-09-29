/**
 * Must-have partner preferences applied as hard search filters (audit P2).
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');
const { sanitizeMustHaves, mustHaveClauses } = require('../../../utils/preferenceFit');

describe('preferenceFit helpers', () => {
  it('keeps only known keys, once each, and tolerates junk', () => {
    expect(sanitizeMustHaves(['age', 'city', 'age', 'income', 5])).toEqual(['age', 'city']);
    expect(sanitizeMustHaves('["height"]')).toEqual(['height']);
    expect(sanitizeMustHaves('nope')).toEqual([]);
    expect(sanitizeMustHaves({ age: true })).toEqual([]);
    expect(sanitizeMustHaves(null)).toEqual([]);
  });

  it('drops a must-have that has no value behind it instead of matching nobody', () => {
    expect(mustHaveClauses({ mustHavePreferences: ['age', 'city', 'education'] })).toEqual({ clauses: [], applied: [] });
    const r = mustHaveClauses({ mustHavePreferences: ['age', 'city'], preferredAgeMin: 25, preferredCity: ['Mohali'] });
    expect(r.applied).toEqual(['age', 'city']);
    expect(r.clauses).toHaveLength(2);
  });
});

describeDb('must-have search filters', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  const yearsAgo = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };

  t('excludes candidates that fail a must-have, keeps unknowns, and can be switched off', async () => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const tag = `Mh${Date.now().toString(36)}`;
    const mk = (over) => makeMember({ profile: { gender: 'female', city: tag, ...over } });
    const okAge = await mk({ dateOfBirth: yearsAgo(28), education: 'M.Tech', height: 165 });
    const tooOld = await mk({ dateOfBirth: yearsAgo(41), education: 'M.Tech', height: 165 });
    const lowEdu = await mk({ dateOfBirth: yearsAgo(28), education: '12th Pass', height: 165 });
    const unknownEdu = await mk({ dateOfBirth: yearsAgo(28), education: null, height: 165 });
    const tooShort = await mk({ dateOfBirth: yearsAgo(28), education: 'Masters', height: 140 });
    const viewer = await makeMember({ profile: {
      gender: 'male',
      preferredAgeMin: 24, preferredAgeMax: 32, preferredEducation: 'Bachelor', preferredHeightMin: 150, preferredHeightMax: 190,
      mustHavePreferences: ['age', 'education', 'height'],
    } });
    ids.push(okAge.user.id, tooOld.user.id, lowEdu.user.id, unknownEdu.user.id, tooShort.user.id, viewer.user.id);

    const res = await call(searchProfiles, { user: viewer.user, query: { city: tag, limit: '50' } });
    expect(res.statusCode).toBe(200);
    const found = res.body.profiles.map((p) => p.userId);
    expect(found).toEqual(expect.arrayContaining([okAge.user.id, unknownEdu.user.id]));
    expect(found).not.toContain(tooOld.user.id);
    expect(found).not.toContain(lowEdu.user.id);
    expect(found).not.toContain(tooShort.user.id);
    expect(res.body.mustHaves.applied).toEqual(expect.arrayContaining(['age', 'education', 'height']));

    const off = await call(searchProfiles, { user: viewer.user, query: { city: tag, limit: '50', mustHaves: 'off' } });
    const offIds = off.body.profiles.map((p) => p.userId);
    expect(offIds).toEqual(expect.arrayContaining([okAge.user.id, tooOld.user.id, lowEdu.user.id, tooShort.user.id]));
    expect(off.body.mustHaves.applied).toEqual([]);
  });

  t('preferences without must-haves stay soft, and updateProfile stores a sanitized list', async () => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const { updateProfile } = require('../../../controllers/profileController');
    const tag = `Ms${Date.now().toString(36)}`;
    const old = await makeMember({ profile: { gender: 'female', city: tag, dateOfBirth: yearsAgo(45) } });
    const viewer = await makeMember({ profile: { gender: 'male', preferredAgeMin: 24, preferredAgeMax: 30 } });
    ids.push(old.user.id, viewer.user.id);
    const soft = await call(searchProfiles, { user: viewer.user, query: { city: tag, limit: '50' } });
    expect(soft.body.profiles.map((p) => p.userId)).toContain(old.user.id);

    const saved = await call(updateProfile, { user: viewer.user, body: { mustHavePreferences: ['age', 'bogus'] } });
    expect(saved.statusCode).toBe(200);
    const hard = await call(searchProfiles, { user: viewer.user, query: { city: tag, limit: '50' } });
    expect(hard.body.profiles.map((p) => p.userId)).not.toContain(old.user.id);
  });
});
