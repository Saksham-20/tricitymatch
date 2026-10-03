/**
 * Discovery fixes (feature interrogation DISC-01, 13, 15, 18, 21, 22):
 * profession and caste filters, must-haves in daily matches and suggestions,
 * passed profiles hidden from Search, the daily set not freezing an empty or
 * stale day, and the saved-search alert counting what Search would list.
 */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const yearsAgo = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
const tagOf = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

describeDb('discovery filters', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));
  const mk = async (profile, user) => { const m = await makeMember({ profile, user }); ids.push(m.user.id); return m; };
  const search = async (viewer, query) => {
    const { searchProfiles } = require('../../../controllers/searchController');
    const res = await call(searchProfiles, { user: viewer.user, query: { limit: '50', ...query } });
    expect(res.statusCode).toBe(200);
    return res;
  };
  const found = async (viewer, query) => (await search(viewer, query)).body.profiles.map((p) => p.userId);

  t('profession: a dropdown group is exact; typed text matches the group OR the words', async () => {
    const city = tagOf('Pf');
    const viewer = await mk({ gender: 'male' });
    const soft = await mk({ gender: 'female', city, profession: 'Software Engineer' });
    const mech = await mk({ gender: 'female', city, profession: 'Mechanical Engineer' });
    const analyst = await mk({ gender: 'female', city, profession: 'Data Analyst' });

    // The group label selects that group alone: "Engineer" is not every Software Engineer.
    expect(await found(viewer, { city, profession: 'Engineer' })).toEqual([mech.user.id]);
    expect(await found(viewer, { city, profession: 'Software / IT' })).toEqual([soft.user.id]);
    // Typed words: the classified group OR a contains match.
    const typed = await found(viewer, { city, profession: 'Software Engineer' });
    expect(typed).toEqual(expect.arrayContaining([soft.user.id]));
    expect(typed).not.toContain(analyst.user.id);
    // "Consultant" classifies to Business, but an "IT Consultant" is filed under
    // Software / IT: the contains half of the OR still finds them.
    const itConsultant = await mk({ gender: 'female', city, profession: 'IT Consultant' });
    const consultants = await found(viewer, { city, profession: 'Consultant' });
    expect(consultants).toEqual(expect.arrayContaining([itConsultant.user.id, analyst.user.id]));
    expect(consultants).not.toContain(mech.user.id);
    // "Mechanical" classifies to nothing; it must still find the people who wrote it.
    expect(await found(viewer, { city, profession: 'Mechanical' })).toEqual([mech.user.id]);
  });

  t('caste: canonical + legacy spellings are found, and a short name does not match a longer one', async () => {
    const { sequelize } = require('../../../models');
    const city = tagOf('Cs');
    const viewer = await mk({ gender: 'male' });
    const canonical = await mk({ gender: 'female', city, caste: 'Jatt' });
    const legacy = await mk({ gender: 'female', city, caste: 'Jatt' });
    // A row written before spellings were canonicalised (the hook would rewrite it).
    await sequelize.query(`UPDATE "Profiles" SET "caste" = 'Jat Sikh' WHERE "userId" = :id`, { replacements: { id: legacy.user.id } });
    const bhati = await mk({ gender: 'female', city, caste: 'Bhati' });
    const bhatia = await mk({ gender: 'female', city, caste: 'Bhatia' });

    for (const typed of ['Jatt', 'Jat Sikh', 'jat']) {
      expect(await found(viewer, { city, caste: typed })).toEqual(expect.arrayContaining([canonical.user.id, legacy.user.id]));
    }
    const onlyBhati = await found(viewer, { city, caste: 'Bhati' });
    expect(onlyBhati).toContain(bhati.user.id);
    expect(onlyBhati).not.toContain(bhatia.user.id);
  });

  t('Search hides profiles the member passed on; showPassed brings them back', async () => {
    const { Match } = require('../../../models');
    const city = tagOf('Ps');
    const viewer = await mk({ gender: 'male' });
    const passed = await mk({ gender: 'female', city });
    const fresh = await mk({ gender: 'female', city });
    await Match.create({ userId: viewer.user.id, matchedUserId: passed.user.id, action: 'pass' });

    const hidden = await found(viewer, { city });
    expect(hidden).toContain(fresh.user.id);
    expect(hidden).not.toContain(passed.user.id);

    const shown = await search(viewer, { city, showPassed: 'true' });
    const row = shown.body.profiles.find((p) => p.userId === passed.user.id);
    expect(row).toBeTruthy();
    expect(row.matchStatus).toBe('pass');
  });

  t('must-haves also shape Today\'s matches and suggestions', async () => {
    const { getDailyMatches } = require('../../../controllers/matchController');
    const { getSuggestions } = require('../../../controllers/searchController');
    const city = tagOf('Mh');
    const viewer = await mk({ gender: 'male', preferredCity: [city], mustHavePreferences: ['city'] });
    const inCity = await mk({ gender: 'female', city });
    const elsewhere = await mk({ gender: 'female', city: `Else${city}` });

    const daily = await call(getDailyMatches, { user: viewer.user });
    expect(daily.statusCode).toBe(200);
    const dailyIds = daily.body.matches.map((m) => m.userId);
    expect(dailyIds).toContain(inCity.user.id);
    expect(dailyIds).not.toContain(elsewhere.user.id);

    const sugg = await call(getSuggestions, { user: viewer.user, query: { limit: '50' } });
    const suggIds = sugg.body.suggestions.map((m) => m.userId);
    expect(suggIds).toContain(inCity.user.id);
    expect(suggIds).not.toContain(elsewhere.user.id);
  });

  t('Today\'s matches: an empty day is not frozen, and an acted-on profile leaves the set', async () => {
    const { getDailyMatches } = require('../../../controllers/matchController');
    const { Match } = require('../../../models');
    // Nobody is 90-99 years old, so the first look finds no candidates.
    const city = tagOf('Dy');
    const same = { city, religion: 'Hindu', height: 170, diet: 'vegetarian', smoking: 'never', drinking: 'never' };
    const viewer = await mk({ gender: 'male', dateOfBirth: yearsAgo(28), ...same, preferredAgeMin: 90, preferredAgeMax: 99, mustHavePreferences: ['age'] });
    const first = await call(getDailyMatches, { user: viewer.user });
    expect(first.body.matches).toEqual([]);

    // The member widens their preference and new people exist: the next visit
    // must see them, not the empty set cached an hour ago.
    // Same profile as the viewer, so it ranks first even if the test database holds other people.
    const candidate = await mk({ gender: 'female', dateOfBirth: yearsAgo(28), ...same });
    await viewer.profile.update({ preferredAgeMin: 24, preferredAgeMax: 40 });
    const second = await call(getDailyMatches, { user: viewer.user });
    expect(second.body.matches.map((m) => m.userId)).toContain(candidate.user.id);

    // Acting on a card removes it from the (cached) set.
    await Match.create({ userId: viewer.user.id, matchedUserId: candidate.user.id, action: 'like' });
    const third = await call(getDailyMatches, { user: viewer.user });
    expect(third.body.matches.map((m) => m.userId)).not.toContain(candidate.user.id);
  });

  t('the saved-search alert counts exactly what Search lists (blocks, gender, must-haves, every saved filter)', async () => {
    const { Profile, User, Block } = require('../../../models');
    const { buildSearchWhere } = require('../../../utils/searchFilters');
    const { loadViewerContext } = require('../../../utils/profileVisibility');
    const { sanitizeSavedFilters } = require('../../../utils/savedSearches');
    const { Op } = require('sequelize');
    const city = tagOf('Al');
    const viewer = await mk({ gender: 'male' });
    const match1 = await mk({ gender: 'female', city, diet: 'vegetarian', education: 'Masters' });
    const wrongDiet = await mk({ gender: 'female', city, diet: 'vegan', education: 'Masters' });
    const wrongEdu = await mk({ gender: 'female', city, diet: 'vegetarian', education: '12th Pass' });
    const sameGender = await mk({ gender: 'male', city, diet: 'vegetarian', education: 'Masters' });
    const blocked = await mk({ gender: 'female', city, diet: 'vegetarian', education: 'Masters' });
    await Block.create({ blockerId: viewer.user.id, blockedUserId: blocked.user.id });

    // What the web saves for this search (every filter on screen), after the server's whitelist.
    const saved = sanitizeSavedFilters({ city: [city], diet: 'vegetarian', education: 'Master', sortBy: 'age', junk: 'x' });
    expect(saved).toEqual({ city: [city], diet: 'vegetarian', education: 'Master', sortBy: 'age' });

    const viewerProfile = await Profile.findOne({ where: { userId: viewer.user.id } });
    const { where } = buildSearchWhere({ filters: saved, currentProfile: viewerProfile, viewerCtx: await loadViewerContext(viewer.user.id) });
    where.createdAt = { [Op.gte]: new Date(Date.now() - 24 * 3600 * 1000) };
    const counted = await Profile.count({
      where, include: [{ model: User, attributes: [], where: { status: 'active' }, required: true }], distinct: true, col: 'id',
    });

    const listed = await found(viewer, { city, diet: 'vegetarian', education: 'Master' });
    expect(listed).toEqual([match1.user.id]);
    expect(counted).toBe(listed.length);
    for (const other of [wrongDiet, wrongEdu, sameGender, blocked]) expect(listed).not.toContain(other.user.id);
  });

  t('a profile that never chose preferred cities has none (no default), and a city must-have then does nothing', async () => {
    const { Profile } = require('../../../models');
    const city = tagOf('Pc');
    const viewer = await mk({ gender: 'male', mustHavePreferences: ['city'] });
    const row = await Profile.findOne({ where: { userId: viewer.user.id } });
    expect(row.preferredCity).toBeNull();
    // Zirakpur is outside the old default list; nothing hides it now.
    const nearby = await mk({ gender: 'female', city });
    const res = await search(viewer, { city });
    expect(res.body.profiles.map((p) => p.userId)).toContain(nearby.user.id);
    expect(res.body.mustHaves.applied).toEqual([]);
  });
});
