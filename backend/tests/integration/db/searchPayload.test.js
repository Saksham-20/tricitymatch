/**
 * Search returns list cards, not whole profiles, and pages are capped at 50.
 */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('search payload', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('each result is a card: sensitive profile fields are absent, card fields are present', async () => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const tag = `Sp${Date.now().toString(36)}`;
    const target = await makeMember({ profile: {
      gender: 'female', city: tag, birthTime: '06:15', placeOfBirth: 'Chandigarh', bio: 'private bio',
      fatherOccupation: 'Banker', motherOccupation: 'Teacher', brothers: 2, income: 900000,
    } });
    const viewer = await makeMember({ profile: { gender: 'male' } });
    ids.push(target.user.id, viewer.user.id);
    const res = await call(searchProfiles, { user: viewer.user, query: { city: tag } });
    expect(res.statusCode).toBe(200);
    const card = res.body.profiles.find((p) => p.userId === target.user.id);
    expect(card).toBeDefined();
    expect(card.firstName).toBe('It');
    expect(card.dateOfBirth).toBeDefined();
    for (const k of ['birthTime', 'placeOfBirth', 'bio', 'fatherOccupation', 'motherOccupation', 'brothers', 'income', 'createdAt', 'User', 'email', 'phone']) {
      expect(card).not.toHaveProperty(k);
    }
    expect(Object.keys(card).length).toBeLessThan(40);
  });

  t('a page can be at most 50 results however large a limit is asked for', async () => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const viewer = await makeMember({ profile: { gender: 'male' } });
    ids.push(viewer.user.id);
    const res = await call(searchProfiles, { user: viewer.user, query: { limit: '100' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.profiles.length).toBeLessThanOrEqual(50);
    expect(res.body.pagination.limit).toBeLessThanOrEqual(50);
  });
});
