/**
 * Profile visibility — ONE implementation for every place that lists or looks
 * up another member's profile.
 *
 * Search, getProfile and the compatibility/kundli endpoints each applied the
 * privacy rules by hand, and the rest (daily matches, suggestions, by-code,
 * likes, shortlist, sent, mutual, viewers) applied a subset or none: they
 * returned photos a member had blurred until match, profiles set to
 * matches-only, incognito members, and internal fields (`quizAnswers`, the
 * member's private `savedSearches`) that no viewer should ever receive.
 *
 * Two halves, so a listing cannot apply one and forget the other:
 *   1. WHO may appear   -> listingScope() / stillVisible()
 *   2. WHAT is disclosed -> redactForViewer()
 */

const { Op } = require('sequelize');
const { Block, Match, Profile, User } = require('../models');
const { getActiveSubscription } = require('./entitlements');

// Keys that belong to the owner and are never useful to anyone else. Note
// `dateOfBirth` stays: clients derive age from it today. Replacing it with a
// server-computed age is a client-contract change tracked separately.
const OWNER_ONLY_KEYS = [
  'quizAnswers',
  'incognitoMode',
  'profileVisibility',
  'showPhone',
  'showEmail',
  'showOnlineStatus',
  'showLastSeen',
  'photoBlurUntilMatch',
];

/**
 * Everything a viewer's listing needs to know about their own relationships,
 * loaded once per request.
 */
const loadViewerContext = async (viewerId) => {
  const [blocks, mutualRows] = await Promise.all([
    Block.findAll({
      where: { [Op.or]: [{ blockerId: viewerId }, { blockedUserId: viewerId }] },
      attributes: ['blockerId', 'blockedUserId'],
    }),
    Match.findAll({ where: { userId: viewerId, isMutual: true }, attributes: ['matchedUserId'] }),
  ]);
  return {
    viewerId,
    blockedIds: [...new Set(blocks.map((b) => (b.blockerId === viewerId ? b.blockedUserId : b.blockerId)))],
    mutualIds: new Set(mutualRows.map((m) => m.matchedUserId)),
  };
};

/**
 * A matches-only member is visible only to their mutual matches. Also used on its
 * own by lists of people the viewer has already acted on (shortlist, sent).
 */
const matchesOnlyClause = (ctx) => ({
  [Op.or]: [
    { profileVisibility: { [Op.is]: null } },
    { profileVisibility: { [Op.ne]: 'matches_only' } },
    ...(ctx.mutualIds.size ? [{ userId: { [Op.in]: [...ctx.mutualIds] } }] : []),
  ],
});

/**
 * Sequelize `where` fragment for Profile listing queries. Spread it, then add
 * the caller's own filters. Also join User with `status: 'active'` (see
 * ACTIVE_USER_INCLUDE) — account status lives on Users, not Profiles.
 *
 * @param {object}  ctx                    from loadViewerContext
 * @param {boolean} [opts.includeIncognito] by-code is a direct lookup of a code
 *        the member chose to share, so it does not hide incognito members the
 *        way discovery does.
 */
const listingScope = (ctx, { includeIncognito = false } = {}) => {
  return {
    isActive: true,
    ...(includeIncognito ? {} : { incognitoMode: { [Op.ne]: true } }),
    userId: {
      [Op.ne]: ctx.viewerId,
      ...(ctx.blockedIds.length ? { [Op.notIn]: ctx.blockedIds } : {}),
    },
    [Op.and]: [matchesOnlyClause(ctx)],
  };
};

const ACTIVE_USER_ATTRS = ['id', 'status', 'isBoosted', 'boostExpiresAt'];
const activeUserInclude = () => ({ model: User, attributes: ACTIVE_USER_ATTRS, where: { status: 'active' } });

/**
 * Re-validate candidates that were computed earlier (the per-day daily-match
 * cache). A member who went matches-only, incognito, was blocked, banned,
 * deactivated or erased AFTER the set was cached must not keep appearing until
 * midnight. One indexed IN query; returns the items that are still listable.
 */
const stillVisible = async (viewerId, items) => {
  if (!items || items.length === 0) return [];
  const ctx = await loadViewerContext(viewerId);
  const ids = items.map((i) => i.userId);
  const rows = await Profile.findAll({
    where: { ...listingScope(ctx), userId: { [Op.in]: ids, [Op.ne]: viewerId, ...(ctx.blockedIds.length ? { [Op.notIn]: ctx.blockedIds } : {}) } },
    attributes: ['userId', 'photoBlurUntilMatch'],
    include: [{ model: User, attributes: ['id'], where: { status: 'active' }, required: true }],
  });
  const blurNow = new Map(rows.map((r) => [r.userId, Boolean(r.photoBlurUntilMatch)]));
  return items
    .filter((i) => blurNow.has(i.userId))
    // A member can switch photo blur on AFTER the set was cached; apply the
    // CURRENT setting. Cached candidates are never mutual matches (interacted
    // profiles are excluded when the set is built), so blur always applies.
    .map((i) => (blurNow.get(i.userId) ? { ...i, profilePhoto: null, photos: [] } : i));
};

/**
 * Whether the viewer may receive intro media URLs (voice/video) in a LIST.
 * Same rule as getProfile: mutual match, or a live paid plan. Resolve once per
 * request, not per row.
 */
const viewerHasPaidAccess = async (viewerId) => Boolean(await getActiveSubscription(viewerId));

/**
 * Delete keys that belong to the owner from a serialised profile, in place:
 * the private settings, quiz answers, and the member's own saved searches
 * (which live inside `lifestylePreferences`).
 */
const stripOwnerOnlyKeys = (obj) => {
  for (const key of OWNER_ONLY_KEYS) delete obj[key];
  if (obj.lifestylePreferences) obj.lifestylePreferences = stripSavedSearches(obj.lifestylePreferences);
  return obj;
};

const stripSavedSearches = (lifestylePreferences) => {
  if (!lifestylePreferences || typeof lifestylePreferences !== 'object') return lifestylePreferences;
  // eslint-disable-next-line no-unused-vars
  const { savedSearches, ...rest } = lifestylePreferences;
  return rest;
};

/**
 * What a viewer may see of another member's profile row. Pure; takes the
 * already-serialised profile (`profile.toJSON()`), returns a new object.
 *
 * @param {object}  raw
 * @param {object}  ctx
 * @param {boolean} ctx.isMutual    viewer and owner are a mutual match
 * @param {boolean} ctx.isSelf      viewer is the owner (nothing is redacted)
 * @param {boolean} ctx.hasPaidAccess viewer holds a live paid plan
 */
const redactForViewer = (raw, { isMutual = false, isSelf = false, hasPaidAccess = false } = {}) => {
  if (isSelf) return { ...raw };

  const out = { ...raw };

  // Photo blur until match — enforced here in the payload, not left to the UI.
  if (raw.photoBlurUntilMatch && !isMutual) {
    out.profilePhoto = null;
    out.photos = [];
  }

  // Voice/video intros: the URL is a public media link, so withholding it is the
  // only real gate. Mutual match or a paid plan, exactly as getProfile.
  if (!isMutual && !hasPaidAccess) {
    out.voiceIntroUrl = null;
    out.videoIntroUrl = null;
  }

  // Lists never carry social links; the detail page applies per-link visibility.
  delete out.socialMediaLinks;

  if (out.lifestylePreferences) {
    out.lifestylePreferences = stripSavedSearches(out.lifestylePreferences);
  }

  stripOwnerOnlyKeys(out);
  delete out.User;
  return out;
};

module.exports = {
  OWNER_ONLY_KEYS,
  loadViewerContext,
  listingScope,
  matchesOnlyClause,
  activeUserInclude,
  stillVisible,
  viewerHasPaidAccess,
  redactForViewer,
  stripOwnerOnlyKeys,
};
