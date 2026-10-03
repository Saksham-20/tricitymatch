/**
 * Search Controller
 * Handles profile search with optimized queries
 */

const { Profile, User, Match, Subscription, Verification } = require('../models');
const { Op } = require('sequelize');
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
const { rankBreakdown } = require('../utils/rankingWeights');
const { weightsFor } = require('../utils/rankingExperiment');
const { buildSearchWhere } = require('../utils/searchFilters');
const { mustHaveClauses } = require('../utils/preferenceFit');

// Ranked search scores the newest CANDIDATE_CAP matching profiles together, so the
// order is global rather than per page. Past the cap the directory is larger than
// one ranked pool; the response says so (pagination.capped).
const CANDIDATE_CAP = 500;

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
  const { where, mustHave } = buildSearchWhere({
    filters: {
      ageMin, ageMax, heightMin, heightMax, city, education, profession,
      diet, smoking, drinking, interestTags, religion, caste, maritalStatus,
      incomeMin, incomeMax, motherTongue, manglikFilter, verifiedOnly,
    },
    currentProfile,
    viewerCtx,
    mustHavesOff: mustHaves === 'off',
    showPassed: showPassed === 'true' || showPassed === true,
  });

  const rankedSearch = sortBy === 'compatibility';

  // Column-backed sorts run at the DB level so they paginate correctly;
  // 'compatibility' is computed in JS below, so it keeps the default order.
  const orderClause =
    sortBy === 'age'      ? [['dateOfBirth', 'DESC']]  // youngest first
    : sortBy === 'location' ? [['city', 'ASC']]
    : [['createdAt', 'DESC']];                          // recent / compatibility / default

  // Get profiles — include isBoosted + boostExpiresAt for ranking
  const profiles = await Profile.findAll({
    where,
    // PERF-1: exclude heavy JSONB columns that search cards never render and
    // calculateCompatibility never reads — they're detail-page/internal-only.
    // Cuts query cost + JSON serialization + response bandwidth on this 30/min endpoint.
    attributes: {
      exclude: [
        'quizAnswers',
        'profilePrompts',
        'socialMediaLinks',
        'personalityValues',
        'familyPreferences',
        'lifestylePreferences',
        'spotifyPlaylist',
      ],
    },
    include: [
      {
        model: User,
        attributes: ['id', 'status', 'isBoosted', 'boostExpiresAt'],
        where: { status: 'active' }
      }
    ],
    // Ranked search pulls the whole candidate pool and pages in memory below;
    // column sorts page in SQL.
    limit: rankedSearch ? CANDIDATE_CAP : parseInt(limit),
    offset: rankedSearch ? 0 : parseInt(offset),
    order: orderClause
  });

  // Batch query for match statuses (fixes N+1)
  const profileUserIds = profiles.map(p => p.userId);
  const [existingMatches, activeSubscriptions, verifications] = await Promise.all([
    profileUserIds.length > 0
      ? Match.findAll({
        where: {
          userId,
          matchedUserId: { [Op.in]: profileUserIds }
        }
      })
      : [],
    profileUserIds.length > 0
      ? Subscription.findAll({
        where: {
          userId: { [Op.in]: profileUserIds },
          status: 'active',
          planType: { [Op.in]: PAID_PLANS },
          [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
        },
        attributes: ['userId', 'planType']
      })
      : [],
    profileUserIds.length > 0
      ? Verification.findAll({
        where: {
          userId: { [Op.in]: profileUserIds },
          status: 'approved'
        },
        attributes: ['userId']
      })
      : []
  ]);

  // Create lookup maps
  const matchMap = new Map();
  existingMatches.forEach(match => {
    matchMap.set(match.matchedUserId, match);
  });

  // Keep highest plan per user (vip > premium_plus > basic_premium)
  const planRank = { nri: 4, vip: 4, elite: 3, premium_plus: 2, basic_premium: 1 };
  const subMap = new Map();
  activeSubscriptions.forEach(s => {
    const existing = subMap.get(s.userId);
    if (!existing || (planRank[s.planType] || 0) > (planRank[existing] || 0)) {
      subMap.set(s.userId, s.planType);
    }
  });

  // Verified user IDs set
  const verifiedUserIds = new Set(verifications.map(v => v.userId));

  const now = new Date();

  const viewerPaid = await viewerHasPaidAccess(userId);

  // Score every candidate (cheap: no serialisation yet).
  // The live weights, or this member's arm of a running ranking experiment.
  const { weights } = weightsFor(userId);
  const scored = profiles.map((profile) => {
    const compatibilityScore = calculateCompatibility(currentProfile, profile);
    const premiumPlan = subMap.get(profile.userId) || null;
    const isBoosted = Boolean(profile.User?.isBoosted &&
      (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > now));
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

  const profilesWithCompatibility = pageRows.map(({ profile, compatibilityScore, premiumPlan, isBoosted, rank }) => {
    const match = matchMap.get(profile.userId);
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
  });

  // Get total count — must apply the SAME User join as the rows query above.
  // Counting profiles alone included members whose account is suspended or
  // deleted, so the header said "7 profiles found" while six could ever load,
  // and pagination advertised pages that always came back empty.
  const total = await Profile.count({
    where,
    include: [{ model: User, attributes: [], where: { status: 'active' }, required: true }],
    distinct: true,
    col: 'id',
  });

  // A ranked pool is at most CANDIDATE_CAP deep; do not advertise pages past it.
  const reachable = rankedSearch ? Math.min(total, CANDIDATE_CAP) : total;

  res.json({
    success: true,
    profiles: profilesWithCompatibility,
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

  const profiles = await Profile.findAll({
    where: {
      ...scope,
      ...genderFilter
    },
    include: [
      {
        model: User,
        attributes: ['id', 'status', 'isBoosted', 'boostExpiresAt'],
        where: { status: 'active' }
      }
    ],
    limit: limit * 2 // Get more to filter by compatibility
  });

  // Batch-fetch active subscriptions + verifications for suggestion profiles
  const suggestionUserIds = profiles.map(p => p.userId);
  const [suggestionSubs, suggestionVerifications] = await Promise.all([
    suggestionUserIds.length > 0
      ? Subscription.findAll({
        where: {
          userId: { [Op.in]: suggestionUserIds },
          status: 'active',
          planType: { [Op.in]: PAID_PLANS },
          [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
        },
        attributes: ['userId', 'planType']
      })
      : [],
    suggestionUserIds.length > 0
      ? Verification.findAll({
        where: { userId: { [Op.in]: suggestionUserIds }, status: 'approved' },
        attributes: ['userId']
      })
      : []
  ]);

  const verifiedSuggestionIds = new Set(suggestionVerifications.map(v => v.userId));

  const planRankSug = { nri: 4, vip: 4, elite: 3, premium_plus: 2, basic_premium: 1 };
  const subMapSug = new Map();
  suggestionSubs.forEach(s => {
    const existing = subMapSug.get(s.userId);
    if (!existing || (planRankSug[s.planType] || 0) > (planRankSug[existing] || 0)) {
      subMapSug.set(s.userId, s.planType);
    }
  });

  const nowSug = new Date();

  // Calculate compatibility and sort with the same admin-tunable weights as search.
  const { weights: weightsSug } = weightsFor(userId);
  const profilesWithCompatibility = profiles.map(profile => {
    const isBoostedActive = profile.User?.isBoosted &&
      (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > nowSug);
    return {
      profile,
      compatibilityScore: calculateCompatibility(currentProfile, profile),
      premiumPlan: subMapSug.get(profile.userId) || null,
      isBoosted: isBoostedActive,
    };
  });

  const suggestionScore = (item) => rankBreakdown({
    compatibilityScore: item.compatibilityScore,
    premiumPlan: item.premiumPlan,
    isBoosted: Boolean(item.isBoosted),
    // Suggestions do not load verification or photo state; neutral, not penalised.
    isVerified: false,
    hasPhoto: true,
  }, weightsSug).total;
  profilesWithCompatibility.sort((a, b) => suggestionScore(b) - suggestionScore(a));

  // Return top matches
  const topMatches = profilesWithCompatibility
    .slice(0, limit)
    .map(item => {
      // Never mutual (interacted profiles are excluded above), so blur applies.
      const raw = redactForViewer(item.profile.toJSON(), { isMutual: false, hasPaidAccess: viewerPaid });
      const premiumPlan = item.premiumPlan;
      const profileData = {
        ...raw,
        userId: raw.userId || raw.User?.id || item.profile.userId,
        compatibilityScore: item.compatibilityScore,
        isPremium: !!premiumPlan,
        premiumPlan,
        isBoosted: item.isBoosted,
        isVerified: verifiedSuggestionIds.has(raw.userId || item.profile.userId),
      };

      return toCardProfile(profileData);
    });

  res.json({
    success: true,
    suggestions: topMatches
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
