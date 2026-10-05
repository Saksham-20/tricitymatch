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

const { Op, literal } = require('sequelize');
const { Block, Match, Profile, User } = require('../models');
const { getActiveSubscription } = require('./entitlements');
const { applyFieldVisibility } = require('../constants/fieldVisibility');
const { normalizeGotra, gotraSql } = require('./gotra');
const { maskProfileText } = require('./contactInText');
const { AGE_VERIFIABLE_WHERE } = require('./ageVerifiable');
// Member-vs-staff rule for relationship lists, direct profile reads, chat and
// calls (role only; see utils/memberRole). Re-exported below.
const memberRole = require('./memberRole');

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
  'fieldVisibility',
  'mustHavePreferences',
  'excludeSameGotra',
];

/**
 * What a LIST card needs, and nothing more.
 *
 * Search and suggestion responses used to carry the whole Profile row (about 85
 * keys) for every result: birth time and place, parents' occupations, bio,
 * partner preferences, creation time and so on, for up to 100 people per request.
 * Anyone with a login could harvest that at 30 requests a minute. A card shows a
 * name, a photo, a few facts and a score, and the full profile is one opened
 * profile away (where visibility, blocks and the owner's per-field choices are
 * applied and a profile view is recorded). The list is the union of what the web
 * ProfileCard and the mobile cards/screens read, plus the shared
 * ProfileSummary contract, so shipped clients keep working.
 *
 * `dateOfBirth` stays because those clients derive age from it; replacing it
 * with a server-computed age is a client-contract change tracked separately.
 */
const CARD_KEYS = [
  'id', 'userId', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'age', 'height',
  'city', 'state', 'religion', 'caste', 'profession', 'education',
  'profilePhoto', 'photos', 'completionPercentage',
  'isVerified', 'verificationStatus', 'isPremium', 'premiumPlan', 'isBoosted',
  'compatibilityScore', 'matchStatus', 'isMutual', 'reasons',
];

const toCardProfile = (data) => {
  const card = {};
  for (const key of CARD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) card[key] = data[key];
  }
  return card;
};

/**
 * Everything a viewer's listing needs to know about their own relationships,
 * loaded once per request.
 */
const loadViewerContext = async (viewerId) => {
  const [blocks, mutualRows, viewerProfile] = await Promise.all([
    Block.findAll({
      where: { [Op.or]: [{ blockerId: viewerId }, { blockedUserId: viewerId }] },
      attributes: ['blockerId', 'blockedUserId'],
    }),
    Match.findAll({ where: { userId: viewerId, isMutual: true }, attributes: ['matchedUserId'] }),
    Profile.findOne({ where: { userId: viewerId }, attributes: ['gotra', 'excludeSameGotra'] }),
  ]);
  return {
    viewerId,
    blockedIds: [...new Set(blocks.map((b) => (b.blockerId === viewerId ? b.blockedUserId : b.blockerId)))],
    mutualIds: new Set(mutualRows.map((m) => m.matchedUserId)),
    // For the same-gotra rule (see gotraClause). Empty when the viewer gave none.
    gotra: normalizeGotra(viewerProfile && viewerProfile.gotra),
    excludeSameGotra: Boolean(viewerProfile && viewerProfile.excludeSameGotra),
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
 * Same-gotra rule, both directions. A candidate is left out when
 *   - the viewer asked to avoid their own gotra and the candidate shares it, or
 *   - the candidate asked to avoid THEIR own gotra and the viewer shares it.
 * A side with no gotra recorded is never excluded, and never excludes.
 */
const gotraClause = (ctx) => {
  if (!ctx.gotra) return null;
  const mine = Profile.sequelize.escape(ctx.gotra);
  const theirs = gotraSql('"Profile"."gotra"');
  const parts = [`("Profile"."excludeSameGotra" = true AND ${theirs} = ${mine})`];
  if (ctx.excludeSameGotra) parts.push(`${theirs} = ${mine}`);
  return Profile.sequelize.literal(`NOT (${parts.join(' OR ')})`);
};

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
// Staff are not candidates. Admin and partner accounts are created with
// placeholder identity (partners get gender 'other', DOB 1990-01-01), and an
// admin promoted from a personal account can read every member's data — none of
// them belongs in a member's search results or daily matches.
//
// Members an admin made invisible (Users.hiddenAt) are left out the same way,
// everywhere a listing is built, including a profile-code lookup.
const UNLISTED_USERS_SQL = `(SELECT id FROM "Users" WHERE role <> 'user' OR "hiddenAt" IS NOT NULL)`;
const STAFF_EXCLUDED = {
  userId: { [Op.notIn]: literal(UNLISTED_USERS_SQL) },
};

const listingScope = (ctx, { includeIncognito = false, applyGotra = true } = {}) => {
  const gotra = applyGotra ? gotraClause(ctx) : null;
  return {
    isActive: true,
    // Nobody whose age cannot be checked (no date of birth / gender yet) is listed.
    ...AGE_VERIFIABLE_WHERE,
    ...(includeIncognito ? {} : { incognitoMode: { [Op.ne]: true } }),
    userId: {
      [Op.ne]: ctx.viewerId,
      ...(ctx.blockedIds.length ? { [Op.notIn]: ctx.blockedIds } : {}),
    },
    [Op.and]: [matchesOnlyClause(ctx), STAFF_EXCLUDED, ...(gotra ? [gotra] : [])],
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
    attributes: ['userId', 'photoBlurUntilMatch', 'profilePhoto', 'photos'],
    include: [{ model: User, attributes: ['id'], where: { status: 'active' }, required: true }],
  });
  const live = new Map(rows.map((r) => [r.userId, r]));
  return items
    .filter((i) => live.has(i.userId))
    .map((i) => {
      const row = live.get(i.userId);
      // A member can switch photo blur on AFTER the set was cached; apply the
      // CURRENT setting. Cached candidates are never mutual matches (interacted
      // profiles are excluded when the set is built), so blur always applies.
      if (row.photoBlurUntilMatch) return { ...i, profilePhoto: null, photos: [] };
      // The cached copy is up to a day old: a photo the member deleted or
      // replaced since must not keep showing to everyone until midnight.
      const out = { ...i };
      if (row.profilePhoto !== undefined) out.profilePhoto = row.profilePhoto || null;
      if (row.photos !== undefined) out.photos = row.photos || [];
      return out;
    });
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

  // Income / birth details per the owner's own field-level choice. Must run
  // before stripOwnerOnlyKeys removes the setting.
  applyFieldVisibility(out, { isMutual, isSelf: false });

  // Lists never carry social links; the detail page applies per-link visibility.
  delete out.socialMediaLinks;

  if (out.lifestylePreferences) {
    out.lifestylePreferences = stripSavedSearches(out.lifestylePreferences);
  }

  stripOwnerOnlyKeys(out);
  delete out.User;
  // Contact details saved in profile text before they were refused at save.
  maskProfileText(out);
  return out;
};

module.exports = {
  ...memberRole,
  UNLISTED_USERS_SQL,
  STAFF_EXCLUDED,
  OWNER_ONLY_KEYS,
  CARD_KEYS,
  toCardProfile,
  loadViewerContext,
  listingScope,
  matchesOnlyClause,
  activeUserInclude,
  stillVisible,
  viewerHasPaidAccess,
  redactForViewer,
  stripOwnerOnlyKeys,
};
