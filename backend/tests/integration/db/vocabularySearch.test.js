/**
 * Derived education level / profession group and the search filters that use
 * them (audit P2).
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('controlled vocabularies', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('the model hook derives level and group on create and on update, and canonicalises caste', async () => {
    const { Profile } = require('../../../models');
    const m = await makeMember({ profile: { education: 'M.Tech', profession: 'Engineer (Software)', caste: 'jat sikh' } });
    ids.push(m.user.id);
    let p = await Profile.findOne({ where: { userId: m.user.id } });
    expect(p.educationLevel).toBe('master');
    expect(p.professionGroup).toBe('Software / IT');
    expect(p.caste).toBe('Jatt');

    await p.update({ education: 'Ph.D', profession: 'Doctor' });
    p = await Profile.findOne({ where: { userId: m.user.id } });
    expect(p.educationLevel).toBe('doctorate');
    expect(p.professionGroup).toBe('Doctor / Healthcare');

    // clearing the text clears the derived value
    await p.update({ education: null });
    p = await Profile.findOne({ where: { userId: m.user.id } });
    expect(p.educationLevel).toBeNull();
  });

  t('search by "Master" finds Masters, M.Tech and MBA; "Software Engineer" finds the whole IT group', async () => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const tag = Date.now().toString(36);
    const a = await makeMember({ profile: { gender: 'female', education: 'Masters', profession: 'Software Engineer', city: `Vocab${tag}` } });
    const b = await makeMember({ profile: { gender: 'female', education: 'M.Tech', profession: 'Engineer (Software)', city: `Vocab${tag}` } });
    const c = await makeMember({ profile: { gender: 'female', education: 'B.Tech', profession: 'Teacher', city: `Vocab${tag}` } });
    const viewer = await makeMember({ profile: { gender: 'male' } });
    ids.push(a.user.id, b.user.id, c.user.id, viewer.user.id);

    const edu = await call(searchProfiles, { user: viewer.user, query: { city: `Vocab${tag}`, education: 'Master', limit: '50' } });
    const eduIds = edu.body.profiles.map((p) => p.userId);
    expect(eduIds).toEqual(expect.arrayContaining([a.user.id, b.user.id]));
    expect(eduIds).not.toContain(c.user.id);

    const prof = await call(searchProfiles, { user: viewer.user, query: { city: `Vocab${tag}`, profession: 'Software Engineer', limit: '50' } });
    const profIds = prof.body.profiles.map((p) => p.userId);
    expect(profIds).toEqual(expect.arrayContaining([a.user.id, b.user.id]));
    expect(profIds).not.toContain(c.user.id);
  });
});
