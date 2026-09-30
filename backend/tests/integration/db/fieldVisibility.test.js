/**
 * Per-field visibility for income and birth details (audit P2).
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');
const { applyFieldVisibility, sanitizeFieldVisibility } = require('../../../constants/fieldVisibility');

describe('fieldVisibility helpers', () => {
  it('sanitizes to known groups and levels only', () => {
    expect(sanitizeFieldVisibility({ income: 'hidden', birthDetails: 'matches', dateOfBirth: 'hidden', x: 1 }))
      .toEqual({ income: 'hidden', birthDetails: 'matches' });
    expect(sanitizeFieldVisibility({ income: 'secret' })).toEqual({});
    expect(sanitizeFieldVisibility('{"income":"matches"}')).toEqual({ income: 'matches' });
    expect(sanitizeFieldVisibility('not json')).toEqual({});
    expect(sanitizeFieldVisibility(['income'])).toEqual({});
    expect(sanitizeFieldVisibility(null)).toEqual({});
  });

  it('withholds by level: hidden never, matches only when mutual, the owner always', () => {
    const make = () => ({ income: 900000, birthTime: '10:30', placeOfBirth: 'Delhi', fieldVisibility: { income: 'hidden', birthDetails: 'matches' } });
    const stranger = applyFieldVisibility(make(), { isMutual: false });
    expect(stranger).toMatchObject({ income: null, birthTime: null, placeOfBirth: null });
    const mutual = applyFieldVisibility(make(), { isMutual: true });
    expect(mutual).toMatchObject({ income: null, birthTime: '10:30', placeOfBirth: 'Delhi' });
    const self = applyFieldVisibility(make(), { isSelf: true });
    expect(self).toMatchObject({ income: 900000, birthTime: '10:30' });
    // nothing set = everyone, so existing profiles do not change
    expect(applyFieldVisibility({ income: 5, birthTime: 'x', fieldVisibility: {} }, {})).toMatchObject({ income: 5, birthTime: 'x' });
    expect(applyFieldVisibility({ income: 5 }, {})).toMatchObject({ income: 5 });
  });
});

describeDb('field visibility end to end', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('getProfile withholds hidden income and matches-only birth details from a stranger, never from the owner', async () => {
    const { getProfile } = require('../../../controllers/profileController');
    const owner = await makeMember({ profile: {
      income: 1200000, birthTime: '06:15', placeOfBirth: 'Chandigarh',
      fieldVisibility: { income: 'hidden', birthDetails: 'matches' },
    } });
    const viewer = await makeMember();
    ids.push(owner.user.id, viewer.user.id);

    const seen = await call(getProfile, { user: viewer.user, params: { userId: owner.user.id } });
    expect(seen.statusCode).toBe(200);
    expect(seen.body.profile.income).toBeNull();
    expect(seen.body.profile.birthTime).toBeNull();
    expect(seen.body.profile.placeOfBirth).toBeNull();
    expect(seen.body.profile).not.toHaveProperty('fieldVisibility');

    const own = await call(getProfile, { user: owner.user, params: { userId: owner.user.id } });
    expect(own.body.profile.income).toBe(1200000);
    expect(own.body.profile.fieldVisibility).toEqual({ income: 'hidden', birthDetails: 'matches' });
  });

  t('updateProfile stores a sanitized setting and merges groups', async () => {
    const { updateProfile } = require('../../../controllers/profileController');
    const m = await makeMember();
    ids.push(m.user.id);
    const first = await call(updateProfile, { user: m.user, body: { fieldVisibility: { income: 'hidden', bogus: 'x' } } });
    expect(first.statusCode).toBe(200);
    const second = await call(updateProfile, { user: m.user, body: { fieldVisibility: { birthDetails: 'matches' } } });
    expect(second.statusCode).toBe(200);
    const { Profile } = require('../../../models');
    const stored = await Profile.findOne({ where: { userId: m.user.id } });
    expect(stored.fieldVisibility).toEqual({ income: 'hidden', birthDetails: 'matches' });
  });

  t('an income range filter does not surface a member who hid their income', async () => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const hider = await makeMember({ profile: { income: 7770000, gender: 'female', fieldVisibility: { income: 'hidden' } } });
    const shower = await makeMember({ profile: { income: 7770000, gender: 'female' } });
    const viewer = await makeMember({ profile: { gender: 'male' } });
    ids.push(hider.user.id, shower.user.id, viewer.user.id);

    const res = await call(searchProfiles, { user: viewer.user, query: { incomeMin: '7770000', incomeMax: '7770000', limit: '50' } });
    expect(res.statusCode).toBe(200);
    const found = (res.body.profiles || []).map((p) => p.userId);
    expect(found).toContain(shower.user.id);
    expect(found).not.toContain(hider.user.id);
  });
});
