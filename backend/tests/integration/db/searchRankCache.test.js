/**
 * Ranked search and suggestions cache only their ORDER (utils/searchRankCache).
 *
 * What must hold:
 *   - a cached page 1 + page 2 + page 3 is exactly the uncached ranking, with no
 *     profile twice, and every card is identical to what the uncached path prints;
 *   - anyone hidden, passed on, deactivated, made matches-only, made staff or
 *     blocked after the list was cached is gone on the very next request;
 *   - editing your own profile ranks afresh;
 *   - a broken cache (or a broken cached path) still answers, the uncached way;
 *   - suggestions drop a profile the member liked after they were cached.
 */
const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

describeDb('ranked search cache', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  // The cached path falls back to the uncached ranking on any error, which
  // would let a broken cached path pass these tests on the fallback's answers.
  // Every happy-path test asserts that no fallback happened.
  let warn;
  beforeEach(() => { warn = jest.spyOn(require('../../../middlewares/logger').log, 'warn'); });
  const fallbacks = () => warn.mock.calls
    .filter(([msg, meta]) => String(msg).startsWith('[search') && !(meta && /^forced/.test(meta.error)))
    .map(([msg, meta]) => `${msg}: ${meta && meta.error}`);

  const controller = () => require('../../../controllers/searchController');
  const rankCache = () => require('../../../utils/searchRankCache');
  const mk = async (opts) => { const m = await makeMember(opts); ids.push(m.user.id); return m; };
  const yearsAgo = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
  const sql = (text, replacements) => require('../../../config/database').query(text, { replacements });

  const search = async (viewer, query) => {
    const res = await call(controller().searchProfiles, { user: viewer.user, query: { sortBy: 'compatibility', ...query } });
    expect(res.statusCode).toBe(200);
    return res.body;
  };
  const userIdsOf = (body) => body.profiles.map((p) => p.userId);

  // Count pool-ranking queries (the narrow, raw one) made while `fn` runs.
  const countPoolQueries = async (fn) => {
    const { Profile } = require('../../../models');
    const spy = jest.spyOn(Profile, 'findAll');
    try {
      const out = await fn();
      return { out, poolQueries: spy.mock.calls.filter(([opts]) => opts && opts.raw === true).length };
    } finally {
      spy.mockRestore();
    }
  };

  // Forces the original (uncached) ranking for the duration of `fn`.
  const uncached = async (fn) => {
    const spy = jest.spyOn(rankCache(), 'readRanked').mockRejectedValue(new Error('forced: rank uncached'));
    try { return await fn(); } finally { spy.mockRestore(); }
  };

  const NAKSHATRAS = ['rohini', 'ashwini', 'magha', 'hasta', 'swati', 'revati', 'pushya'];
  const EDUCATION = ['B.Tech', 'M.Tech', '12th Pass', 'MBA'];
  const DIETS = ['vegetarian', 'non-vegetarian', 'vegan'];
  const HABITS = ['never', 'occasionally', 'regularly'];
  const TAGS = ['music', 'travel', 'cooking', 'cricket', 'reading'];

  const viewerProfile = (city) => ({
    gender: 'male', city, state: 'Punjab', dateOfBirth: yearsAgo(30), height: 175,
    religion: 'Hindu', education: 'B.Tech', diet: 'vegetarian', smoking: 'never', drinking: 'never',
    nakshatra: 'rohini', rashi: 'Vrishabha', manglikStatus: 'non_manglik', interestTags: ['music', 'travel'],
    preferredAgeMin: 24, preferredAgeMax: 32, preferredHeightMin: 150, preferredHeightMax: 175,
  });

  // A spread of candidates whose compatibility, photo and boost state differ, with
  // distinct createdAt so ties in rank keep a deterministic newest-first order.
  const makeCandidates = async (tag, n) => {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const m = await mk({
        user: i % 7 === 3 ? { isBoosted: true, boostExpiresAt: new Date(Date.now() + 86400000) } : {},
        profile: {
          gender: 'female',
          city: i % 3 === 0 ? `${tag}Home` : `${tag}X${i}`,
          state: i % 2 ? 'Punjab' : 'Haryana',
          dateOfBirth: yearsAgo(22 + (i % 12)),
          height: 150 + ((i * 7) % 35),
          religion: i % 4 === 1 ? 'Sikh' : 'Hindu',
          education: EDUCATION[i % EDUCATION.length],
          diet: DIETS[i % DIETS.length],
          smoking: HABITS[i % HABITS.length],
          drinking: HABITS[(i + 1) % HABITS.length],
          nakshatra: i % 5 === 4 ? null : NAKSHATRAS[i % NAKSHATRAS.length],
          rashi: i % 5 === 4 ? 'Kanya' : null,
          manglikStatus: i % 6 === 0 ? 'manglik' : 'non_manglik',
          interestTags: TAGS.slice(i % 3, (i % 3) + 2),
          photos: i % 5 === 2 ? [] : [`https://example.test/p/${i}.jpg`],
        },
      });
      await sql(`UPDATE "Profiles" SET "createdAt" = NOW() - (:mins || ' minutes')::interval WHERE "userId" = :id`,
        { mins: String(i + 1), id: m.user.id });
      out.push(m);
    }
    return out;
  };

  t('every candidate-side column compatibility reads is in the narrow scoring set, and both give the same score', async () => {
    const { calculateCompatibility } = require('../../../utils/compatibility');
    const { Profile } = require('../../../models');
    const { SCORING_ATTRIBUTES } = controller();
    const allowed = new Set(SCORING_ATTRIBUTES.map((a) => (Array.isArray(a) ? a[1] : a)));
    const tag = `Rs${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    const cands = await makeCandidates(tag, 8);
    // educationLevel absent forces the fallback that reads `education` itself.
    const variants = [{}, { educationLevel: null }, { city: 'Elsewhere' }, { nakshatra: null, rashi: 'Mesha' }];

    const read = new Set();
    for (const c of cands) {
      const full = await Profile.findOne({ where: { userId: c.user.id } });
      for (const over of variants) {
        const target = { ...full.get({ plain: true }), ...over };
        const probe = new Proxy(target, { get(o, key) { if (typeof key === 'string') read.add(key); return o[key]; } });
        calculateCompatibility(viewer.profile, probe);
      }
      const narrow = await Profile.findOne({ where: { userId: c.user.id }, attributes: SCORING_ATTRIBUTES, raw: true });
      expect(calculateCompatibility(viewer.profile, narrow)).toBe(calculateCompatibility(viewer.profile, full));
      expect(narrow.hasPhoto).toBe(Array.isArray(full.photos) && full.photos.length > 0);
    }
    const missing = [...read].filter((k) => !allowed.has(k));
    expect(missing).toEqual([]);
  });

  t('cached pages 1-3 are exactly the uncached ranking: same order, same cards, no repeats', async () => {
    const tag = `Ra${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 24);

    const reference = await uncached(async () => [
      await search(viewer, { city: tag, page: '1', limit: '10' }),
      await search(viewer, { city: tag, page: '2', limit: '10' }),
      await search(viewer, { city: tag, page: '3', limit: '10' }),
    ]);
    expect(reference.flatMap(userIdsOf)).toHaveLength(24);

    await rankCache().clearMember(viewer.user.id);
    const p1 = await countPoolQueries(() => search(viewer, { city: tag, page: '1', limit: '10' }));
    const p2 = await countPoolQueries(() => search(viewer, { city: tag, page: '2', limit: '10' }));
    const p3 = await countPoolQueries(() => search(viewer, { city: tag, page: '3', limit: '10' }));
    expect([p1.poolQueries, p2.poolQueries, p3.poolQueries]).toEqual([1, 0, 0]);

    const cached = [p1.out, p2.out, p3.out];
    cached.forEach((body, i) => expect(body).toEqual(reference[i]));
    const all = cached.flatMap(userIdsOf);
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
    // A different page size slices the same cached list.
    const wide = await countPoolQueries(() => search(viewer, { city: tag, page: '1', limit: '24' }));
    expect(wide.poolQueries).toBe(0);
    expect(userIdsOf(wide.out)).toEqual(all);
    expect(fallbacks()).toEqual([]);
  });

  t('the response shape is identical on a cache miss and a cache hit', async () => {
    const tag = `Rd${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 5);
    await rankCache().clearMember(viewer.user.id);

    const miss = await countPoolQueries(() => search(viewer, { city: tag, limit: '20' }));
    const hit = await countPoolQueries(() => search(viewer, { city: tag, limit: '20' }));
    expect([miss.poolQueries, hit.poolQueries]).toEqual([1, 0]);
    expect(hit.out).toEqual(miss.out);
    expect(Object.keys(hit.out).sort()).toEqual(['mustHaves', 'pagination', 'profiles', 'success']);
    expect(Object.keys(hit.out.pagination).sort()).toEqual(['capped', 'limit', 'page', 'pages', 'total']);
    expect(hit.out.pagination).toMatchObject({ page: 1, limit: 20, total: 5, pages: 1, capped: false });
    hit.out.profiles.forEach((card, i) => expect(Object.keys(card).sort()).toEqual(Object.keys(miss.out.profiles[i]).sort()));
    expect(hit.out.profiles[0]).not.toHaveProperty('rankScore');
    expect(fallbacks()).toEqual([]);
  });

  t('anyone hidden, passed on, banned, made matches-only, made staff, paused or blocked after caching is gone next request', async () => {
    const { Match, Block } = require('../../../models');
    const tag = `Rb${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    const [hidden, passed, banned, matchesOnly, staff, paused, blocked] = await makeCandidates(tag, 7);
    await rankCache().clearMember(viewer.user.id);

    const first = await search(viewer, { city: tag, limit: '50' });
    expect(userIdsOf(first)).toHaveLength(7);

    await sql('UPDATE "Users" SET "hiddenAt" = NOW() WHERE id = :id', { id: hidden.user.id });
    await Match.create({ userId: viewer.user.id, matchedUserId: passed.user.id, action: 'pass' });
    await sql(`UPDATE "Users" SET status = 'banned' WHERE id = :id`, { id: banned.user.id });
    await sql(`UPDATE "Profiles" SET "profileVisibility" = 'matches_only' WHERE "userId" = :id`, { id: matchesOnly.user.id });
    await sql(`UPDATE "Users" SET role = 'admin' WHERE id = :id`, { id: staff.user.id });
    await sql('UPDATE "Profiles" SET "isActive" = false WHERE "userId" = :id', { id: paused.user.id });

    // Same signature: served from the cached order, re-validated row by row.
    const second = await countPoolQueries(() => search(viewer, { city: tag, limit: '50' }));
    expect(second.poolQueries).toBe(0);
    expect(userIdsOf(second.out)).toEqual([blocked.user.id]);
    // The header still reports the pool counted when the order was cached.
    expect(second.out.pagination.total).toBe(7);

    // A cached profile that is listable again comes back (the order still holds it).
    await sql('UPDATE "Users" SET "hiddenAt" = NULL WHERE id = :id', { id: hidden.user.id });
    const third = await countPoolQueries(() => search(viewer, { city: tag, limit: '50' }));
    expect(third.poolQueries).toBe(0);
    expect(userIdsOf(third.out).sort()).toEqual([hidden.user.id, blocked.user.id].sort());

    // A new block changes the signature, so the list is ranked again without them.
    await Block.create({ blockerId: viewer.user.id, blockedUserId: blocked.user.id });
    const fourth = await countPoolQueries(() => search(viewer, { city: tag, limit: '50' }));
    expect(fourth.poolQueries).toBe(1);
    expect(userIdsOf(fourth.out)).toEqual([hidden.user.id]);
    expect(fourth.out.pagination.total).toBe(1);
    expect(fallbacks()).toEqual([]);
  });

  t('the page past a dropped profile does not repeat or shift into the previous page', async () => {
    const tag = `Rp${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 6);
    await rankCache().clearMember(viewer.user.id);
    const p1 = userIdsOf(await search(viewer, { city: tag, page: '1', limit: '3' }));
    await sql('UPDATE "Users" SET "hiddenAt" = NOW() WHERE id = :id', { id: p1[0] });
    const p1Again = userIdsOf(await search(viewer, { city: tag, page: '1', limit: '3' }));
    const p2 = userIdsOf(await search(viewer, { city: tag, page: '2', limit: '3' }));
    expect(p1Again).toEqual(p1.slice(1)); // shorter, never refilled from page 2
    expect(p2.filter((id) => p1.includes(id))).toEqual([]);
    expect(p2).toHaveLength(3);
    expect(fallbacks()).toEqual([]);
  });

  t('editing your own profile ranks afresh', async () => {
    const tag = `Rc${uniq()}`;
    const viewer = await mk({ profile: { ...viewerProfile(`${tag}Alpha`), interestTags: [], nakshatra: null, rashi: null } });
    const base = { gender: 'female', dateOfBirth: yearsAgo(28), height: 165, religion: 'Hindu', education: 'B.Tech' };
    const alpha = await mk({ profile: { ...base, city: `${tag}Alpha` } });
    const beta = await mk({ profile: { ...base, city: `${tag}Beta` } });
    await rankCache().clearMember(viewer.user.id);

    expect(userIdsOf(await search(viewer, { city: tag }))).toEqual([alpha.user.id, beta.user.id]);
    await viewer.profile.update({ city: `${tag}Beta` });
    const after = await countPoolQueries(() => search(viewer, { city: tag }));
    expect(after.poolQueries).toBe(1);
    expect(userIdsOf(after.out)).toEqual([beta.user.id, alpha.user.id]);
    expect(fallbacks()).toEqual([]);
  });

  t('filters, must-haves and show-passed each get their own list', async () => {
    const tag = `Rf${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 4);
    await rankCache().clearMember(viewer.user.id);
    const runs = [
      { city: tag },
      { city: tag, religion: 'Sikh' },
      { city: tag, mustHaves: 'off' },
      { city: tag, showPassed: 'true' },
      { city: tag, religion: 'Sikh' },
    ];
    const counts = [];
    for (const q of runs) counts.push((await countPoolQueries(() => search(viewer, q))).poolQueries);
    // One slot per member: switching filters ranks again; the repeat of the
    // previous request is a hit only if nothing else was asked in between.
    expect(counts).toEqual([1, 1, 1, 1, 1]);
    expect((await countPoolQueries(() => search(viewer, { city: tag, religion: 'Sikh' }))).poolQueries).toBe(0);
    expect(fallbacks()).toEqual([]);
  });

  t('column sorts are never cached and still page in SQL', async () => {
    const tag = `Rk${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 3);
    const writes = jest.spyOn(rankCache(), 'writeRanked');
    for (const sortBy of ['age', 'location', 'recent']) {
      const body = await search(viewer, { city: tag, sortBy });
      expect(userIdsOf(body)).toHaveLength(3);
    }
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
    expect(fallbacks()).toEqual([]);
  });

  t('a cache that throws on every read and write still answers, with the uncached ranking', async () => {
    const cache = require('../../../utils/cache');
    const tag = `Re${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 8);
    const reference = await uncached(() => search(viewer, { city: tag, limit: '5' }));

    const get = jest.spyOn(cache, 'get').mockRejectedValue(new Error('redis down'));
    const set = jest.spyOn(cache, 'set').mockRejectedValue(new Error('redis down'));
    try {
      const body = await search(viewer, { city: tag, limit: '5' });
      expect(body).toEqual(reference);
      expect(get).toHaveBeenCalled();
      expect(set).toHaveBeenCalled();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  t('if the cached path itself fails part-way, the search falls back to the uncached ranking', async () => {
    const { Profile } = require('../../../models');
    const tag = `Rg${uniq()}`;
    const viewer = await mk({ profile: viewerProfile(`${tag}Home`) });
    await makeCandidates(tag, 6);
    const reference = await uncached(() => search(viewer, { city: tag, limit: '4' }));
    await rankCache().clearMember(viewer.user.id);

    const real = Profile.findAll.bind(Profile);
    const spy = jest.spyOn(Profile, 'findAll').mockImplementation((opts) => (
      opts && opts.raw === true ? Promise.reject(new Error('narrow query broke')) : real(opts)
    ));
    try {
      expect(await search(viewer, { city: tag, limit: '4' })).toEqual(reference);
    } finally {
      spy.mockRestore();
    }
  });

  t('suggestions: a profile liked or a member blocked after caching is gone; the cards match a fresh computation', async () => {
    const { Match, Block } = require('../../../models');
    const { getSuggestions } = controller();
    const city = `Rsg${uniq()}`;
    const viewer = await mk({ profile: { ...viewerProfile(`${city}Home`), preferredCity: [city], mustHavePreferences: ['city'] } });
    const [liked, blocker, kept] = await makeCandidates(city, 3).then(async (list) => {
      // makeCandidates spreads cities; suggestions here are scoped by the city must-have.
      for (const m of list) await sql('UPDATE "Profiles" SET city = :city WHERE "userId" = :id', { city, id: m.user.id });
      return list;
    });
    await rankCache().clearMember(viewer.user.id);
    const suggest = async () => {
      const res = await call(getSuggestions, { user: viewer.user, query: { limit: '10' } });
      expect(res.statusCode).toBe(200);
      return res.body;
    };

    const writes = jest.spyOn(rankCache(), 'writeSuggestions');
    const first = await suggest();
    expect(first.suggestions.map((s) => s.userId).sort()).toEqual([liked.user.id, blocker.user.id, kept.user.id].sort());
    const again = await suggest();
    expect(again).toEqual(first);
    expect(writes).toHaveBeenCalledTimes(1);

    await Match.create({ userId: viewer.user.id, matchedUserId: liked.user.id, action: 'like' });
    const afterLike = await suggest();
    expect(afterLike.suggestions.map((s) => s.userId)).not.toContain(liked.user.id);
    expect(afterLike.suggestions.map((s) => s.userId)).toEqual(expect.arrayContaining([blocker.user.id, kept.user.id]));

    await Block.create({ blockerId: blocker.user.id, blockedUserId: viewer.user.id });
    const afterBlock = await suggest();
    expect(afterBlock.suggestions.map((s) => s.userId)).toEqual([kept.user.id]);
    expect(writes).toHaveBeenCalledTimes(1);
    writes.mockRestore();

    // The card served from the cached order equals a freshly computed one.
    await rankCache().clearMember(viewer.user.id);
    const fresh = await suggest();
    expect(fresh).toEqual(afterBlock);
    expect(fallbacks()).toEqual([]);
  });

  t('suggestions still answer when the cache is down', async () => {
    const cache = require('../../../utils/cache');
    const { getSuggestions } = controller();
    const city = `Rsd${uniq()}`;
    const viewer = await mk({ profile: { ...viewerProfile(`${city}Home`), preferredCity: [city], mustHavePreferences: ['city'] } });
    const cand = await mk({ profile: { gender: 'female', city, dateOfBirth: yearsAgo(27) } });
    const get = jest.spyOn(cache, 'get').mockRejectedValue(new Error('redis down'));
    const set = jest.spyOn(cache, 'set').mockRejectedValue(new Error('redis down'));
    try {
      const res = await call(getSuggestions, { user: viewer.user, query: { limit: '10' } });
      expect(res.statusCode).toBe(200);
      expect(res.body.suggestions.map((s) => s.userId)).toEqual([cand.user.id]);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
