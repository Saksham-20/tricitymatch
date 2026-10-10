/**
 * Search Controller
 * Handles profile search with optimized queries
 */

const { Profile, User, Match, Subscription, Verification } = require('../models');
const { Op, literal } = require('sequelize');
const { PAID_PLANS } = require('../constants/plans');
const { calculateCompatibility, isManglikCompatible } = require('../utils/compatibility');
const { toProfileCode, parseProfileCode } = require('../utils/profileCode');
const { randomUUID } = require('crypto');
const {
  loadViewerContext,
  listingScope,
  viewerHasPaidAccess,
  redactForViewer,
  toCardProfile,
} = require('../utils/profileVisibility');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { rankBreakdown } = require('../utils/rankingWeights');
const { weightsFor } = require('../utils/rankingExperiment');
const { buildSearchWhere } = require('../utils/searchFilters');
const { mustHaveClauses } = require('../utils/preferenceFit');
// Called through the module object (not destructured) so tests can stand in a
// failing cache.
const searchRankCache = require('../utils/searchRankCache');

// Ranked search scores the newest CANDIDATE_CAP matching profiles together, so the
// order is global rather than per page. Past the cap the directory is larger than
// one ranked pool; the response says so (pagination.capped).
const CANDIDATE_CAP = 500;

// PERF-1: heavy JSONB columns that search cards never render and
// calculateCompatibility never reads — they're detail-page/internal-only.
const CARD_ROW_EXCLUDE = [
  'quizAnswers',
  'profilePrompts',
  'socialMediaLinks',
  'personalityValues',
  'familyPreferences',
  'lifestylePreferences',
  'spotifyPlaylist',
];

// Ranking a candidate needs only what calculateCompatibility(viewer, candidate)
// reads from the CANDIDATE side (age, place, height, religion, education,
// lifestyle, horoscope, interests) plus "has a photo" for the ranking nudge.
// Keep in step with utils/compatibility.js: a column it starts reading must be
// added here, or the pool is ordered without it (searchRankCache.test pins the
// two scores equal). The photo URLs themselves are not needed, only whether
// there is one.
const SCORING_ATTRIBUTES = [
  'userId',
  'gender',
  'dateOfBirth',
  'city',
  'state',
  'height',
  'religion',
  'education',
  'educationLevel',
  'diet',
  'smoking',
  'drinking',
  'nakshatra',
  'rashi',
  'manglikStatus',
  'interestTags',
  [literal('COALESCE(cardinality("Profile"."photos"), 0) > 0'), 'hasPhoto'],
];
// Exported for the test that pins it against what calculateCompatibility reads.
exports.SCORING_ATTRIBUTES = SCORING_ATTRIBUTES;

const PLAN_RANK = { nri: 4, vip: 4, elite: 3, premium_plus: 2, basic_premium: 1 };

// The pool keeps createdAt DESC as its SQL order, so ties in rank keep
// newest-first exactly as before (Array#sort is stable).
const POOL_ORDER = [['createdAt', 'DESC']];

const userInclude = (attributes) => ({ model: User, attributes, where: { status: 'active' } });

/** `where` narrowed to the given members, without touching the original object. */
const withUserIds = (where, userIds) => ({
  ...where,
  [Op.and]: [...(where[Op.and] || []), { userId: { [Op.in]: userIds } }],
});

const isBoostedNow = (user, now) => Boolean(user?.isBoosted &&
  (!user?.boostExpiresAt || new Date(user.boostExpiresAt) > now));

// A narrow pool row carries `hasPhoto`; a full row (or a test double) carries `photos`.
const rowHasPhoto = (row) => row.hasPhoto === true || (Array.isArray(row.photos) && row.photos.length > 0);

/** Highest live paid plan and approved verification for each of these members. */
const loadPlansAndVerifications = async (userIds) => {
  const [activeSubscriptions, verifications] = await Promise.all([
    userIds.length > 0
      ? Subscription.findAll({
        where: {
          userId: { [Op.in]: userIds },
          status: 'active',
          planType: { [Op.in]: PAID_PLANS },
          [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
        },
        attributes: ['userId', 'planType']
      })
      : [],
    userIds.length > 0
      ? Verification.findAll({
        where: {
          userId: { [Op.in]: userIds },
          status: 'approved'
        },
        attributes: ['userId']
      })
      : []
  ]);

  // Keep highest plan per user (vip > premium_plus > basic_premium)
  const subMap = new Map();
  activeSubscriptions.forEach(s => {
    const existing = subMap.get(s.userId);
    if (!existing || (PLAN_RANK[s.planType] || 0) > (PLAN_RANK[existing] || 0)) {
      subMap.set(s.userId, s.planType);
    }
  });

  return { subMap, verifiedUserIds: new Set(verifications.map(v => v.userId)) };
};

/** Count of the whole matching directory — the SAME where and User join as the rows. */
const countMatching = (where) => Profile.count({
  where,
  include: [{ model: User, attributes: [], where: { status: 'active' }, required: true }],
  distinct: true,
  col: 'id',
});

/** One search result card. Shared by every search path so they cannot drift. */
const toSearchCard = (profile, { compatibilityScore, premiumPlan, isBoosted, rank, match, viewerPaid, verifiedUserIds }) => {
  const isMutual = match ? match.isMutual : false;

  // Photo blur, intro-media URLs and owner-only keys are withheld here, in the
  // payload — the same redaction every other listing applies.
  const raw = redactForViewer(profile.toJSON(), { isMutual, hasPaidAccess: viewerPaid });

  const profileData = {
    ...raw,
    userId: raw.userId || raw.User?.id || profile.userId,
    compatibilityScore,
    matchStatus: match ? match.action : null,
    isMutual,
    isBoosted,
    isPremium: !!premiumPlan,
    premiumPlan,
    isVerified: verifiedUserIds.has(raw.userId || profile.userId),
    // Why this profile sits where it does.
    rankScore: rank.total,
    rankFactors: rank.factors,
  };

  // A list card, not the whole profile row (see utils/profileVisibility).
  return toCardProfile(profileData);
};

/**
 * Search without the ranked-order cache: column sorts (paged in SQL) always,
 * and ranked search whenever the cached path cannot run.
 */
const searchUncached = async ({ userId, currentProfile, where, rankedSearch, sortBy, limit, offset }) => {
  // Column-backed sorts run at the DB level so they paginate correctly;
  // 'compatibility' is computed in JS below, so it keeps the default order.
  const orderClause =
    sortBy === 'age'      ? [['dateOfBirth', 'DESC']]  // youngest first
    : sortBy === 'location' ? [['city', 'ASC']]
    : POOL_ORDER;                                      // recent / compatibility / default

  // Get profiles — include isBoosted + boostExpiresAt for ranking
  const profiles = await Profile.findAll({
    where,
    attributes: { exclude: CARD_ROW_EXCLUDE },
    include: [userInclude(['id', 'status', 'isBoosted', 'boostExpiresAt'])],
    // Ranked search pulls the whole candidate pool and pages in memory below;
    // column sorts page in SQL.
    limit: rankedSearch ? CANDIDATE_CAP : parseInt(limit),
    offset: rankedSearch ? 0 : parseInt(offset),
    order: orderClause
  });

  // Batch query for match statuses (fixes N+1)
  const profileUserIds = profiles.map(p => p.userId);
  const [existingMatches, { subMap, verifiedUserIds }] = await Promise.all([
    profileUserIds.length > 0
      ? Match.findAll({
        where: {
          userId,
          matchedUserId: { [Op.in]: profileUserIds }
        }
      })
      : [],
    loadPlansAndVerifications(profileUserIds),
  ]);

  const matchMap = new Map();
  existingMatches.forEach(match => {
    matchMap.set(match.matchedUserId, match);
  });

  const now = new Date();

  const viewerPaid = await viewerHasPaidAccess(userId);

  // Score every candidate (cheap: no serialisation yet).
  // The live weights, or this member's arm of a running ranking experiment.
  const { weights } = weightsFor(userId);
  const scored = profiles.map((profile) => {
    const compatibilityScore = calculateCompatibility(currentProfile, profile);
    const premiumPlan = subMap.get(profile.userId) || null;
    const isBoosted = isBoostedNow(profile.User, now);
    // Verified members get a ranking nudge so getting verified visibly pays off,
    // and a profile with no photograph sorts below anyone who has one. It is not
    // hidden -- that would punish a member who may still be a genuine match --
    // and the penalty out-weighs any single positive nudge so a plan cannot buy
    // it back.
    const rank = rankBreakdown({
      compatibilityScore,
      premiumPlan,
      isBoosted,
      isVerified: verifiedUserIds.has(profile.userId),
      hasPhoto: Array.isArray(profile.photos) && profile.photos.length > 0,
    }, weights);
    return { profile, compatibilityScore, premiumPlan, isBoosted, rank };
  });

  // Order the WHOLE pool, then take the requested page. Sorting after SQL paging
  // (the old behaviour) only re-ordered each page of 20 newest-first rows, so
  // page 2 could hold a better match than page 1.
  if (rankedSearch) scored.sort((a, b) => b.rank.total - a.rank.total);
  const pageRows = rankedSearch ? scored.slice(offset, offset + limit) : scored;

  const cards = pageRows.map(({ profile, compatibilityScore, premiumPlan, isBoosted, rank }) => toSearchCard(profile, {
    compatibilityScore, premiumPlan, isBoosted, rank,
    match: matchMap.get(profile.userId),
    viewerPaid,
    verifiedUserIds,
  }));

  // Get total count — must apply the SAME User join as the rows query above.
  // Counting profiles alone included members whose account is suspended or
  // deleted, so the header said "7 profiles found" while six could ever load,
  // and pagination advertised pages that always came back empty.
  const total = await countMatching(where);

  return { profiles: cards, total };
};

/**
 * Rank the candidate pool on a narrow column set (no full rows, no card
 * serialisation) and return the ordered userIds. Same where, same User join,
 * same newest-500 pool and same ranking inputs as searchUncached, so the order
 * is the same.
 */
const rankCandidatePool = async ({ currentProfile, where, weights }) => {
  const pool = await Profile.findAll({
    where,
    attributes: SCORING_ATTRIBUTES,
    include: [userInclude(['isBoosted', 'boostExpiresAt'])],
    limit: CANDIDATE_CAP,
    offset: 0,
    order: POOL_ORDER,
    raw: true,
    nest: true,
  });

  const lookups = await loadPlansAndVerifications(pool.map((row) => row.userId));
  const now = new Date();
  const scored = pool.map((row) => ({
    userId: row.userId,
    total: rankBreakdown({
      compatibilityScore: calculateCompatibility(currentProfile, row),
      premiumPlan: lookups.subMap.get(row.userId) || null,
      isBoosted: isBoostedNow(row.User, now),
      isVerified: lookups.verifiedUserIds.has(row.userId),
      hasPhoto: rowHasPhoto(row),
    }, weights).total,
  }));
  scored.sort((a, b) => b.total - a.total);

  // A pool shorter than the cap IS the whole matching set (the count uses the
  // same where and User join, and Profile:User is one-to-one), so the count
  // query only runs when the pool is full.
  const total = pool.length < CANDIDATE_CAP ? pool.length : await countMatching(where);
  return { ids: scored.map((s) => s.userId), total, lookups };
};

/**
 * Build one page of a ranked list from the cached order. The page's profiles
 * are reloaded through the CURRENT where, so anyone hidden, blocked, passed on,
 * deactivated or made staff since the order was cached drops out (the page can
 * then be shorter than `limit`). Every value on the card is computed now.
 */
const buildRankedPage = async ({ userId, currentProfile, where, pageIds, weights, lookups }) => {
  if (pageIds.length === 0) return [];

  const rows = await Profile.findAll({
    where: withUserIds(where, pageIds),
    attributes: { exclude: CARD_ROW_EXCLUDE },
    include: [userInclude(['id', 'status', 'isBoosted', 'boostExpiresAt'])],
    // An upper bound only: the IN list is a single page.
    limit: CANDIDATE_CAP,
    offset: 0,
  });
  const byUserId = new Map(rows.map((row) => [row.userId, row]));
  const ordered = pageIds.map((id) => byUserId.get(id)).filter(Boolean);
  const ids = ordered.map((p) => p.userId);

  const [existingMatches, { subMap, verifiedUserIds }, viewerPaid] = await Promise.all([
    ids.length > 0
      ? Match.findAll({ where: { userId, matchedUserId: { [Op.in]: ids } } })
      : [],
    // Fetched moments ago by rankCandidatePool on a cache miss; otherwise now.
    lookups || loadPlansAndVerifications(ids),
    viewerHasPaidAccess(userId),
  ]);
  const matchMap = new Map(existingMatches.map((m) => [m.matchedUserId, m]));

  const now = new Date();
  return ordered.map((profile) => {
    const compatibilityScore = calculateCompatibility(currentProfile, profile);
    const premiumPlan = subMap.get(profile.userId) || null;
    const isBoosted = isBoostedNow(profile.User, now);
    const rank = rankBreakdown({
      compatibilityScore,
      premiumPlan,
      isBoosted,
      isVerified: verifiedUserIds.has(profile.userId),
      hasPhoto: Array.isArray(profile.photos) && profile.photos.length > 0,
    }, weights);
    return toSearchCard(profile, {
      compatibilityScore, premiumPlan, isBoosted, rank,
      match: matchMap.get(profile.userId),
      viewerPaid,
      verifiedUserIds,
    });
  });
};

/** Ranked search through the cached order (utils/searchRankCache). */
const rankedSearchCached = async ({ userId, currentProfile, viewerCtx, where, limit, offset, filters, mustHavesOff, showPassed }) => {
  const ranking = weightsFor(userId);
  const sig = searchRankCache.rankSignature({
    filters, mustHavesOff, showPassed, ranking, viewerProfile: currentProfile, viewerCtx,
  });

  let entry = await searchRankCache.readRanked(userId, sig);
  let lookups = null;
  if (!entry) {
    const fresh = await rankCandidatePool({ currentProfile, where, weights: ranking.weights });
    entry = { sig, ids: fresh.ids, total: fresh.total };
    lookups = fresh.lookups;
    if (sig) await searchRankCache.writeRanked(userId, entry);
  }

  // Fixed indexes of one list, so pages of the same list never repeat a profile.
  const pageIds = entry.ids.slice(offset, offset + limit);
  const profiles = await buildRankedPage({
    userId, currentProfile, where, pageIds, weights: ranking.weights, lookups,
  });
  return { profiles, total: entry.total };
};

// @route   GET /api/search
// @desc    Search profiles with filters
// @access  Private
exports.searchProfiles = asyncHandler(async (req, res) => {
  const {
    ageMin,
    ageMax,
    heightMin,
    heightMax,
    city,
    education,
    profession,
    diet,
    smoking,
    drinking,
    interestTags,
    religion,
    caste,
    maritalStatus,
    incomeMin,
    incomeMax,
    motherTongue,
    manglikFilter,  // 'manglik_only' | 'non_manglik_only' | 'exclude_incompatible'
    verifiedOnly,   // 'true' → only photo-verified members
    sortBy = 'compatibility',
    mustHaves,      // 'off' → ignore the searcher's own must-have preferences
    showPassed      // 'true' → include profiles the member already passed on
  } = req.query;

  const userId = req.user.id;
  // Enforce hard limits — do not trust validator alone
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  // 50, not 100: no client asks for more than 20, and a larger page is a larger scrape per request.
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;

  // Get current user's profile for compatibility calculation
  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) {
    throw createError.badRequest('Please complete your profile first');
  }

  // Who may appear, the gender default, must-haves and every filter live in one
  // shared builder (utils/searchFilters) that the saved-search alert also uses.
  const viewerCtx = await loadViewerContext(userId);
  const filters = {
    ageMin, ageMax, heightMin, heightMax, city, education, profession,
    diet, smoking, drinking, interestTags, religion, caste, maritalStatus,
    incomeMin, incomeMax, motherTongue, manglikFilter, verifiedOnly,
  };
  const mustHavesOff = mustHaves === 'off';
  const showPassedOn = showPassed === 'true' || showPassed === true;
  const { where, mustHave } = buildSearchWhere({
    filters,
    currentProfile,
    viewerCtx,
    mustHavesOff,
    showPassed: showPassedOn,
  });

  const rankedSearch = sortBy === 'compatibility';

  let result = null;
  if (rankedSearch) {
    try {
      result = await rankedSearchCached({
        userId, currentProfile, viewerCtx, where, limit, offset,
        filters, mustHavesOff, showPassed: showPassedOn,
      });
    } catch (err) {
      // Fail open: rank it the original way rather than fail the search.
      log.warn('[search] cached ranking failed, ranking uncached', { error: err.message });
      result = null;
    }
  }
  if (!result) {
    result = await searchUncached({ userId, currentProfile, where, rankedSearch, sortBy, limit, offset });
  }
  const { total } = result;

  // A ranked pool is at most CANDIDATE_CAP deep; do not advertise pages past it.
  const reachable = rankedSearch ? Math.min(total, CANDIDATE_CAP) : total;

  res.json({
    success: true,
    profiles: result.profiles,
    // Which of the member's must-haves shaped this list, so the client can say
    // so and offer to switch them off (?mustHaves=off).
    mustHaves: { applied: mustHave.applied },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(reachable / limit),
      capped: rankedSearch && total > CANDIDATE_CAP
    }
  });
});

/** One suggestion card (never mutual: interacted profiles are excluded). */
const toSuggestionCard = (profile, { compatibilityScore, premiumPlan, isBoosted, viewerPaid, verifiedUserIds }) => {
  const raw = redactForViewer(profile.toJSON(), { isMutual: false, hasPaidAccess: viewerPaid });
  const profileData = {
    ...raw,
    userId: raw.userId || raw.User?.id || profile.userId,
    compatibilityScore,
    isPremium: !!premiumPlan,
    premiumPlan,
    isBoosted,
    isVerified: verifiedUserIds.has(raw.userId || profile.userId),
  };

  return toCardProfile(profileData);
};

// Suggestions keep their historical shape for isBoosted (the raw expression,
// not coerced to a boolean).
const suggestionBoosted = (profile, now) => profile.User?.isBoosted &&
  (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > now);

/** Suggestions computed from scratch. Returns the cards and their order. */
const computeSuggestions = async ({ where, currentProfile, limit, weights, viewerPaid }) => {
  const profiles = await Profile.findAll({
    where,
    include: [userInclude(['id', 'status', 'isBoosted', 'boostExpiresAt'])],
    limit: limit * 2 // Get more to filter by compatibility
  });

  // Batch-fetch active subscriptions + verifications for suggestion profiles
  const { subMap, verifiedUserIds } = await loadPlansAndVerifications(profiles.map(p => p.userId));

  const now = new Date();

  // Calculate compatibility and sort with the same admin-tunable weights as search.
  const items = profiles.map(profile => ({
    profile,
    compatibilityScore: calculateCompatibility(currentProfile, profile),
    premiumPlan: subMap.get(profile.userId) || null,
    isBoosted: suggestionBoosted(profile, now),
  }));

  const suggestionScore = (item) => rankBreakdown({
    compatibilityScore: item.compatibilityScore,
    premiumPlan: item.premiumPlan,
    isBoosted: Boolean(item.isBoosted),
    // Suggestions do not load verification or photo state; neutral, not penalised.
    isVerified: false,
    hasPhoto: true,
  }, weights).total;
  items.sort((a, b) => suggestionScore(b) - suggestionScore(a));

  // Return top matches
  const top = items.slice(0, limit);
  return {
    ids: top.map((item) => item.profile.userId),
    cards: top.map((item) => toSuggestionCard(item.profile, { ...item, viewerPaid, verifiedUserIds })),
  };
};

/** Suggestions through the cached order; the cards are rebuilt from live rows. */
const suggestionsCached = async ({ userId, where, currentProfile, limit, viewerPaid }) => {
  const ranking = weightsFor(userId);
  const sig = searchRankCache.suggestionsSignature({ limit, viewerPaid, ranking, viewerProfile: currentProfile });
  const entry = await searchRankCache.readSuggestions(userId, sig);

  if (!entry) {
    const fresh = await computeSuggestions({ where, currentProfile, limit, weights: ranking.weights, viewerPaid });
    if (sig) await searchRankCache.writeSuggestions(userId, { sig, ids: fresh.ids });
    return fresh.cards;
  }
  if (entry.ids.length === 0) return [];

  // Same where as a fresh computation (which already leaves out everyone the
  // member has interacted with or is blocked by, as of NOW), narrowed to the
  // cached members.
  const rows = await Profile.findAll({
    where: withUserIds(where, entry.ids),
    include: [userInclude(['id', 'status', 'isBoosted', 'boostExpiresAt'])],
    limit: entry.ids.length,
  });
  const byUserId = new Map(rows.map((row) => [row.userId, row]));
  const ordered = entry.ids.map((id) => byUserId.get(id)).filter(Boolean);
  const { subMap, verifiedUserIds } = await loadPlansAndVerifications(ordered.map((p) => p.userId));

  const now = new Date();
  return ordered.map((profile) => toSuggestionCard(profile, {
    compatibilityScore: calculateCompatibility(currentProfile, profile),
    premiumPlan: subMap.get(profile.userId) || null,
    isBoosted: suggestionBoosted(profile, now),
    viewerPaid,
    verifiedUserIds,
  }));
};

// @route   GET /api/search/suggestions
// @desc    Get compatibility-based profile suggestions
// @access  Private
exports.getSuggestions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) {
    throw createError.badRequest('Please complete your profile first');
  }

  // Prefer opposite gender; if current user's gender is missing/other, show both so suggestions aren't empty
  const gender = (currentProfile.gender || '').toLowerCase();
  const genderFilter = gender === 'male'
    ? { gender: 'female' }
    : gender === 'female'
      ? { gender: 'male' }
      : { gender: { [Op.in]: ['male', 'female'] } };

  // Profiles the viewer hasn't interacted with. Who may appear at all is the
  // shared visibility rule; the interacted set is layered on top of it.
  const [interactedUserIds, viewerCtx] = await Promise.all([
    Match.findAll({ where: { userId }, attributes: ['matchedUserId'] })
      .then(matches => matches.map(m => m.matchedUserId)),
    loadViewerContext(userId)
  ]);
  const excludedIds = [...new Set([...interactedUserIds, ...viewerCtx.blockedIds])];
  const scope = listingScope(viewerCtx);
  scope.userId = { [Op.ne]: userId, [Op.notIn]: excludedIds };
  // Must-have partner preferences are hard filters here as in Search.
  const mustHave = mustHaveClauses(currentProfile);
  if (mustHave.clauses.length) scope[Op.and] = [...(scope[Op.and] || []), ...mustHave.clauses];
  const viewerPaid = await viewerHasPaidAccess(userId);

  const where = {
    ...scope,
    ...genderFilter
  };

  let suggestions = null;
  try {
    suggestions = await suggestionsCached({ userId, where, currentProfile, limit, viewerPaid });
  } catch (err) {
    log.warn('[search] cached suggestions failed, computing uncached', { error: err.message });
    suggestions = null;
  }
  if (!suggestions) {
    suggestions = (await computeSuggestions({
      where, currentProfile, limit, weights: weightsFor(userId).weights, viewerPaid,
    })).cards;
  }

  res.json({
    success: true,
    suggestions
  });
});

// @route   GET /api/search/by-code?code=TCS-XXXXXXXX
// @desc    Look up a single profile by its public shareable code
// @access  Private
exports.getProfileByCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const prefix = parseProfileCode(req.query.code);
  if (!prefix) {
    throw createError.badRequest('Enter a valid profile ID, e.g. TCS-A1B2C3D4');
  }

  const isSelfCode = String(userId).slice(0, 8).toLowerCase() === prefix;

  // UTIL-2: the 8-hex code is the first 4 bytes (time_low) of the userId UUID, so
  // match an indexed UUID range instead of LOWER(CAST(userId AS text)) LIKE — the
  // function-wrapped cast defeated the PK btree and forced a seq scan.
  const uuidLo = `${prefix}-0000-0000-0000-000000000000`;
  const uuidHi = `${prefix}-ffff-ffff-ffff-ffffffffffff`;

  // A code the member chose to share is a direct lookup, so incognito does not
  // hide it — but matches-only, blocks, deactivated and banned/suspended accounts
  // do, exactly as in every other listing. (This lookup used to check isActive
  // and blocks only, so a matches-only or banned member was reachable by code.)
  // Looking up your own code is always allowed.
  const viewerCtx = await loadViewerContext(userId);
  const scope = isSelfCode
    ? { isActive: true }
    : listingScope(viewerCtx, { includeIncognito: true, applyGotra: false });

  // Fetch up to 2 to detect (extremely rare) prefix collisions instead of silently
  // returning an arbitrary row, as the old findOne did.
  const matches = await Profile.findAll({
    where: {
      ...scope,
      [Op.and]: [
        ...(scope[Op.and] || []),
        { userId: { [Op.between]: [uuidLo, uuidHi] } },
      ],
    },
    attributes: ['userId', 'firstName', 'lastName', 'dateOfBirth', 'city', 'profession', 'profilePhoto', 'photoBlurUntilMatch'],
    include: [{ model: User, attributes: [], where: { status: 'active' }, required: true }],
    limit: 2,
  });

  if (matches.length === 0) {
    throw createError.notFound('No profile found for that ID');
  }
  if (matches.length > 1) {
    // Code prefix collision — ambiguous; refuse rather than guess.
    throw createError.notFound('No profile found for that ID');
  }
  const profile = matches[0];

  const rawProfile = profile.toJSON();
  const isSelf = rawProfile.userId === userId;

  // Same redaction as every other listing (photo blur until match, owner-only
  // keys). Own profile is shown to itself untouched.
  const raw = redactForViewer(rawProfile, {
    isSelf,
    isMutual: viewerCtx.mutualIds.has(rawProfile.userId),
    hasPaidAccess: false,
  });

  res.json({
    success: true,
    profile: {
      ...raw,
      profileCode: toProfileCode(raw.userId),
      isSelf,
    },
  });
});


// ==================== SAVED SEARCHES (Phase A step 6) ====================
// Stored in Profile.lifestylePreferences.savedSearches — the exact location the
// Bull `saved-search-alerts` job already reads, so saving here lights up the
// existing daily alert with zero migration. Filters are whitelisted to the
// job's shape: { gender, religion, caste, city[], ageMin, ageMax }.

// Sanitiser + cap live in utils/savedSearches so PUT /profile/me (which can
// also write lifestylePreferences.savedSearches) enforces the same rules.
const { MAX_SAVED_SEARCHES, sanitizeSavedFilters } = require('../utils/savedSearches');

// @route   GET /api/search/saved
// @desc    List the current user's saved searches
// @access  Private
exports.getSavedSearches = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ where: { userId: req.user.id }, attributes: ['id', 'lifestylePreferences'] });
  const savedSearches = profile?.lifestylePreferences?.savedSearches;
  res.json({
    success: true,
    savedSearches: Array.isArray(savedSearches) ? savedSearches : []
  });
});

// @route   POST /api/search/saved
// @desc    Save a named search (cap 5)
// @access  Private
exports.createSavedSearch = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.replace(/<[^>]*>/g, '').trim().slice(0, 60) : '';
  if (!name) {
    throw createError.badRequest('Search name is required');
  }

  const filters = sanitizeSavedFilters(req.body.filters);
  if (Object.keys(filters).length === 0) {
    throw createError.badRequest('At least one filter is required');
  }

  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  const prefs = { ...(profile.lifestylePreferences || {}) };
  const existing = Array.isArray(prefs.savedSearches) ? prefs.savedSearches : [];

  if (existing.some(s => s.name === name)) {
    throw createError.conflict('A saved search with this name already exists');
  }
  if (existing.length >= MAX_SAVED_SEARCHES) {
    throw createError.badRequest(`You can save up to ${MAX_SAVED_SEARCHES} searches`);
  }

  const saved = { id: randomUUID(), name, filters };
  prefs.savedSearches = [...existing, saved];

  // JSONB mutation trap: reassign + mark changed, or Sequelize silently skips
  // the column on save.
  profile.lifestylePreferences = prefs;
  profile.changed('lifestylePreferences', true);
  await profile.save();

  res.status(201).json({ success: true, savedSearch: saved });
});

// @route   DELETE /api/search/saved/:id
// @desc    Delete a saved search
// @access  Private
exports.deleteSavedSearch = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const profile = await Profile.findOne({ where: { userId: req.user.id } });
  if (!profile) {
    throw createError.notFound('Profile not found');
  }

  const prefs = { ...(profile.lifestylePreferences || {}) };
  const existing = Array.isArray(prefs.savedSearches) ? prefs.savedSearches : [];
  const next = existing.filter(s => s.id !== id);

  if (next.length === existing.length) {
    throw createError.notFound('Saved search not found');
  }

  prefs.savedSearches = next;
  profile.lifestylePreferences = prefs;
  profile.changed('lifestylePreferences', true);
  await profile.save();

  res.json({ success: true, deletedId: id });
});
