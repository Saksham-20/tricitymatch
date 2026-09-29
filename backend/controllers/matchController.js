/**
 * Match Controller
 * Handles match actions (like/shortlist/pass) with proper transactions
 */

const { Match, Profile, User, Subscription, Block, Verification } = require('../models');
const {
  loadViewerContext,
  listingScope,
  matchesOnlyClause,
  stillVisible,
  viewerHasPaidAccess,
  redactForViewer,
} = require('../utils/profileVisibility');
const { Op, QueryTypes } = require('sequelize');
const { randomUUID } = require('crypto');
const sequelize = require('../config/database');
const { PAID_PLANS } = require('../constants/plans');
const { calculateCompatibility, getCompatibilityBreakdown, deriveReasons } = require('../utils/compatibility');
const { getOrSet } = require('../utils/cache');
const { sendMatchNotification } = require('../utils/emailService');
const { notify } = require('../utils/notifyUser');
const { trackEvent } = require('../utils/trackEvent');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { severRelationshipRows, evictChatRoom } = require('../utils/relationship');

// @route   POST /api/match/:userId
// @desc    Like/shortlist/pass a profile
// @access  Private
exports.matchAction = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action } = req.body;
  const currentUserId = req.user.id;

  // Prevent match actions between blocked users (either direction)
  const blockExists = await Block.findOne({
    where: {
      [Op.or]: [
        { blockerId: currentUserId, blockedUserId: userId },
        { blockerId: userId, blockedUserId: currentUserId }
      ]
    }
  });
  if (blockExists) {
    throw createError.forbidden('Cannot perform this action');
  }

  // The target must be a real, active, visible member. This used to check only
  // blocks, so anyone could like themselves (a self "mutual match"), act on a
  // banned or non-existent id, and send a "liked your profile" notification to a
  // member who had set their profile to matches-only.
  if (userId === currentUserId) {
    throw createError.badRequest('You cannot act on your own profile');
  }
  const [targetUser, targetProfile] = await Promise.all([
    User.findByPk(userId, { attributes: ['id', 'status'] }),
    Profile.findOne({ where: { userId }, attributes: ['isActive', 'profileVisibility'] }),
  ]);
  if (!targetUser || targetUser.status !== 'active' || !targetProfile || !targetProfile.isActive) {
    throw createError.notFound('Profile not found');
  }
  if (targetProfile.profileVisibility === 'matches_only') {
    // Matches-only members can be reached only by someone they already liked.
    const theyLikedMe = await Match.findOne({
      where: { userId, matchedUserId: currentUserId, action: 'like' },
      attributes: ['id'],
    });
    if (!theyLikedMe) throw createError.notFound('Profile not found');
  }

  // Use transaction for consistency
  const result = await sequelize.transaction(async (t) => {
    // Serialise everything that touches this PAIR. Two members liking each other
    // at the same moment each read "no reverse like yet" and neither marked the
    // match mutual; the same race made a withdraw and a re-like interleave. The
    // advisory lock is per unordered pair and released at commit.
    await sequelize.query(
      'SELECT pg_advisory_xact_lock(hashtextextended(:pairKey, 0))',
      { replacements: { pairKey: [currentUserId, userId].sort().join(':') }, transaction: t }
    );

    // Check if match already exists
    let match = await Match.findOne({
      where: {
        userId: currentUserId,
        matchedUserId: userId
      },
      transaction: t
    });
    // What this row said BEFORE this request: every transition below is decided
    // from it, so a repeated tap is a no-op rather than a second announcement.
    const previousAction = match ? match.action : null;
    const wasMutual = Boolean(match && match.isMutual);

    // Calculate compatibility
    const [currentProfile, matchedProfile] = await Promise.all([
      Profile.findOne({ where: { userId: currentUserId }, transaction: t }),
      Profile.findOne({ where: { userId }, transaction: t })
    ]);

    let compatibilityScore = null;
    if (currentProfile && matchedProfile) {
      compatibilityScore = calculateCompatibility(currentProfile, matchedProfile);
    }

    // D3 like-with-note — accepted only with a 'like'. The note is tag-stripped
    // and capped; likedItem is validated AGAINST THE TARGET'S PROFILE and
    // stored as a content SNAPSHOT (ES8: {type:'photo', photoUrl} |
    // {type:'prompt', promptText}), never an index — indexes rot when the
    // target deletes or reorders their gallery.
    let note = null;
    let likedItem = null;
    if (action === 'like') {
      if (typeof req.body.note === 'string' && req.body.note.trim()) {
        note = req.body.note.replace(/<[^>]*>/g, '').trim().slice(0, 280) || null;
      }
      const rawItem = req.body.likedItem;
      if (rawItem && typeof rawItem === 'object' && matchedProfile) {
        if (rawItem.type === 'photo' && typeof rawItem.photoUrl === 'string') {
          const gallery = [matchedProfile.profilePhoto, ...(matchedProfile.photos || [])].filter(Boolean);
          if (gallery.includes(rawItem.photoUrl)) {
            likedItem = { type: 'photo', photoUrl: rawItem.photoUrl };
          }
        } else if (rawItem.type === 'prompt' && typeof rawItem.promptText === 'string') {
          const promptValues = Object.values(matchedProfile.profilePrompts || {})
            .filter(v => typeof v === 'string');
          if (promptValues.includes(rawItem.promptText)) {
            likedItem = { type: 'prompt', promptText: rawItem.promptText.slice(0, 300) };
          }
        }
      }
    }
    const hasNoteContent = Boolean(note || likedItem);

    if (match) {
      // Update existing match. ES4: this ORM branch is the SECOND write path —
      // it must apply the same note semantics as the upsert below: a re-like
      // WITH a note overwrites, a plain re-like preserves the existing note,
      // and a non-like action clears it (a pass shouldn't carry a love note).
      match.action = action;
      match.compatibilityScore = compatibilityScore;
      if (action !== 'like') {
        match.note = null;
        match.likedItem = null;
      } else if (hasNoteContent) {
        match.note = note;
        match.likedItem = likedItem;
      }
      await match.save({ transaction: t });
    } else {
      // Upsert, not create: the find-then-create above is not atomic, so a
      // double-tapped Like raced itself into the (userId, matchedUserId) unique
      // index. In Postgres that aborts the surrounding transaction, so the
      // second tap came back as a 500 instead of simply being the same like.
      // R1: every new column must appear in BOTH the INSERT list and the
      // DO UPDATE SET list, or the conflict path silently drops it.
      await sequelize.query(
        `INSERT INTO "Matches" ("id", "userId", "matchedUserId", "action", "compatibilityScore", "note", "likedItem", "createdAt", "updatedAt")
         VALUES (:id, :userId, :matchedUserId, :action, :score, :note, :likedItem, NOW(), NOW())
         ON CONFLICT ("userId", "matchedUserId")
         DO UPDATE SET "action" = EXCLUDED."action",
                       "compatibilityScore" = EXCLUDED."compatibilityScore",
                       "note" = CASE WHEN EXCLUDED."action" = 'like'
                                     THEN COALESCE(EXCLUDED."note", "Matches"."note")
                                     ELSE NULL END,
                       "likedItem" = CASE WHEN EXCLUDED."action" = 'like'
                                          THEN COALESCE(EXCLUDED."likedItem", "Matches"."likedItem")
                                          ELSE NULL END,
                       "updatedAt" = NOW()`,
        {
          replacements: {
            id: randomUUID(),
            userId: currentUserId,
            matchedUserId: userId,
            action,
            score: compatibilityScore,
            note,
            likedItem: likedItem ? JSON.stringify(likedItem) : null,
          },
          type: QueryTypes.INSERT,
          transaction: t,
        }
      );
      match = await Match.findOne({
        where: { userId: currentUserId, matchedUserId: userId },
        transaction: t,
      });
    }

    // Interest state machine (per row: none | like | shortlist | pass).
    //   * Any action may follow any other; a member can change their mind.
    //   * Leaving 'like' while the pair is mutual WITHDRAWS the match: the mutual
    //     flag, chat grant and live calls end, and the other member's like stays
    //     as an ordinary one-way like. (Previously a pass left isMutual=true on
    //     both rows, so chat carried on.)
    //   * Liking a member who liked you makes the match mutual exactly once;
    //     liking again while already mutual changes nothing and announces nothing.
    let isMutualMatch = wasMutual;
    let newlyMutual = false;
    let withdrawn = false;

    if (action !== 'like' && wasMutual) {
      await severRelationshipRows(currentUserId, userId, { transaction: t, clearMutualDate: true });
      match.isMutual = false;
      match.mutualMatchDate = null;
      isMutualMatch = false;
      withdrawn = true;
    } else if (action === 'like' && !wasMutual) {
      const reverseMatch = await Match.findOne({
        where: {
          userId,
          matchedUserId: currentUserId,
          action: 'like'
        },
        transaction: t
      });

      if (reverseMatch) {
        // Mutual match! Update both records
        isMutualMatch = true;
        newlyMutual = true;
        const mutualDate = new Date();

        match.isMutual = true;
        match.mutualMatchDate = mutualDate;
        await match.save({ transaction: t });

        reverseMatch.isMutual = true;
        reverseMatch.mutualMatchDate = mutualDate;
        await reverseMatch.save({ transaction: t });
      }
    }

    const firstLike = action === 'like' && previousAction !== 'like';

    return { match, isMutualMatch, newlyMutual, withdrawn, firstLike, currentProfile, matchedProfile };
  });

  // Funnel stage 5 — first expressed interest. 'pass' is a rejection, not an
  // interest, so only like/shortlist count. Emitted unconditionally on those:
  // the partial unique index (userId, eventType) collapses every later like into
  // a no-op, so this stays "first". Fire-and-forget: never awaited.
  if (action === 'like' || action === 'shortlist') {
    trackEvent(currentUserId, 'first_interest_sent');
  }

  // Send notifications outside transaction (non-critical)
  setImmediate(async () => {
    try {
      const [currentUser, matchedUser] = await Promise.all([
        User.findByPk(currentUserId),
        User.findByPk(userId)
      ]);

      if (!currentUser || !matchedUser) return;

      const currentName = result.currentProfile
        ? `${result.currentProfile.firstName} ${result.currentProfile.lastName}`
        : 'Someone';
      const matchedName = result.matchedProfile
        ? `${result.matchedProfile.firstName} ${result.matchedProfile.lastName}`
        : 'Someone';

      if (result.newlyMutual) {
        // Mutual match — notify both users in-app + email (once: only on the
        // transition, never for a repeated like)
        await Promise.all([
          notify(userId, 'new_match', "It's a Match!", `You and ${currentName} liked each other!`, result.match.id),
          notify(currentUserId, 'new_match', "It's a Match!", `You and ${matchedName} liked each other!`, result.match.id),
        ]);

        const profileUrl = `${config.server.frontendUrl}/profile/${userId}`;
        const matchedProfileUrl = `${config.server.frontendUrl}/profile/${currentUserId}`;
        Promise.all([
          sendMatchNotification(matchedUser.email, currentName, profileUrl),
          sendMatchNotification(currentUser.email, matchedName, matchedProfileUrl),
        ]).catch(err => log.error('Failed to send match emails', { error: err.message }));
      } else if (result.firstLike && !result.isMutualMatch) {
        // One-way like — notify the liked user in-app only (no email, avoid spam).
        // D3: a like-with-note leads with what was liked + the note.
        const item = result.match.likedItem;
        const noteText = result.match.note;
        let body;
        if (item || noteText) {
          const what = item?.type === 'prompt' ? 'prompt' : item ? 'photo' : 'profile';
          body = `${currentName} liked your ${what}${noteText ? `: "${noteText}"` : ''}`;
        } else {
          body = `${currentName} liked your profile. Like them back to connect!`;
        }
        await notify(userId, 'new_match', 'Someone liked your profile!', body, result.match.id);
      }
    } catch (error) {
      log.error('Error sending match notifications', { error: error.message, userId, currentUserId });
    }
  });

  // Socket half of a withdrawal (the database half ran in the transaction).
  if (result.withdrawn) evictChatRoom(currentUserId, userId);

  res.json({
    success: true,
    match: result.match,
    isMutual: result.isMutualMatch,
    // True only on the request that CREATED the match, so a client can celebrate
    // once. `isMutual` stays the truthful current state.
    newMatch: result.newlyMutual,
    withdrawn: result.withdrawn
  });
});

// ---- Daily matches helpers ----
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_CACHE_SIZE = 15; // cache the top set; slice per tier on return

// IST calendar day key (YYYY-MM-DD) so the set rolls over at local midnight
const istDateKey = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
// Seconds until next IST midnight (cache TTL)
const secondsToNextISTMidnight = () => {
  const istNow = Date.now() + IST_OFFSET_MS;
  const sinceMidnight = istNow % DAY_MS;
  return Math.max(60, Math.ceil((DAY_MS - sinceMidnight) / 1000));
};

const premiumBoost = (plan) => (plan === 'vip' || plan === 'nri' ? 20 : plan === 'elite' ? 15 : plan === 'premium_plus' ? 10 : plan === 'basic_premium' ? 5 : 0);

// Compute the ranked daily set for a user (top DAILY_CACHE_SIZE). Pure read.
const computeDailyMatches = async (userId) => {
  const currentProfile = await Profile.findOne({ where: { userId } });
  if (!currentProfile) return [];

  const gender = (currentProfile.gender || '').toLowerCase();
  const genderFilter = gender === 'male'
    ? { gender: 'female' }
    : gender === 'female'
      ? { gender: 'male' }
      : { gender: { [Op.in]: ['male', 'female'] } };

  const [interacted, viewerCtx] = await Promise.all([
    Match.findAll({ where: { userId }, attributes: ['matchedUserId'] }).then(rows => rows.map(r => r.matchedUserId)),
    loadViewerContext(userId),
  ]);
  const excludedIds = [...new Set([...interacted, ...viewerCtx.blockedIds])];

  // Who may appear is the shared visibility rule (incognito, matches-only,
  // blocks, inactive); the already-interacted set is layered on top.
  const scope = listingScope(viewerCtx);
  scope.userId = { [Op.ne]: userId, [Op.notIn]: excludedIds };

  const profiles = await Profile.findAll({
    where: {
      ...scope,
      ...genderFilter,
    },
    include: [{ model: User, attributes: ['id', 'status', 'isBoosted', 'boostExpiresAt'], where: { status: 'active' } }],
    limit: DAILY_CACHE_SIZE * 4, // over-fetch, rank, then cap
  });

  const candidateIds = profiles.map(p => p.userId);
  const [subs, verifications] = await Promise.all([
    candidateIds.length
      ? Subscription.findAll({
          where: {
            userId: { [Op.in]: candidateIds },
            status: 'active',
            planType: { [Op.in]: PAID_PLANS },
            [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
          },
          attributes: ['userId', 'planType'],
        })
      : [],
    candidateIds.length
      ? Verification.findAll({ where: { userId: { [Op.in]: candidateIds }, status: 'approved' }, attributes: ['userId'] })
      : [],
  ]);

  const verifiedIds = new Set(verifications.map(v => v.userId));
  const planRank = { nri: 4, vip: 4, elite: 3, premium_plus: 2, basic_premium: 1 };
  const subMap = new Map();
  subs.forEach(s => {
    const cur = subMap.get(s.userId);
    if (!cur || (planRank[s.planType] || 0) > (planRank[cur] || 0)) subMap.set(s.userId, s.planType);
  });

  const now = new Date();
  const ranked = profiles
    .map(profile => {
      const isBoosted = profile.User?.isBoosted && (!profile.User?.boostExpiresAt || new Date(profile.User.boostExpiresAt) > now);
      const plan = subMap.get(profile.userId) || null;
      return {
        profile,
        plan,
        isBoosted,
        score: calculateCompatibility(currentProfile, profile) + premiumBoost(plan) + (isBoosted ? 8 : 0),
        compatibilityScore: calculateCompatibility(currentProfile, profile),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, DAILY_CACHE_SIZE)
    .map(item => {
      // The set is cached for the day and shared by every tier, so it is stored
      // in its most restricted form: never mutual (interacted profiles are
      // excluded above) so blur applies, and no intro-media URLs. Cards do not
      // need them; the profile page fetches them under the viewer's live tier.
      const raw = redactForViewer(item.profile.toJSON(), { isMutual: false, hasPaidAccess: false });
      return {
        ...raw,
        userId: raw.userId,
        compatibilityScore: item.compatibilityScore,
        isPremium: !!item.plan,
        premiumPlan: item.plan,
        isBoosted: item.isBoosted,
        isVerified: verifiedIds.has(raw.userId),
        // D4: "why this match" chips — computed only for the final sliced set
        // (audit #6: avoids breakdown calls on the 4x over-fetch). Throw-safe:
        // deriveReasons returns [] on bad data.
        reasons: deriveReasons(getCompatibilityBreakdown(currentProfile, item.profile)),
      };
    });

  return ranked;
};

// @route   GET /api/match/daily
// @desc    "Matches of the day" — same compatibility-ranked set per user per IST day
// @access  Private (free: 5, premium/vip: 15)
exports.getDailyMatches = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Viewer tier sets how many of the cached set they see
  const viewerSub = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }],
    },
    attributes: ['planType'],
  });
  const isPremiumViewer = !!viewerSub;
  const visibleCount = isPremiumViewer ? 15 : 5;

  const cacheKey = `daily-matches:v2:${userId}:${istDateKey()}`;
  // Cache the full ranked set once per IST day; recompute on Redis miss.
  const cachedSet = await getOrSet(cacheKey, () => computeDailyMatches(userId), secondsToNextISTMidnight());

  // The set lives all day, but members change: one can go matches-only or
  // incognito, be blocked, banned, deactivated or erased after it was cached.
  // Re-check every candidate against current state so none of them keeps
  // appearing until midnight (this also covers an erased member's profile JSON
  // still sitting in other viewers' caches).
  const fullSet = await stillVisible(userId, cachedSet || []);

  res.json({
    success: true,
    matches: fullSet.slice(0, visibleCount),
    isPremium: isPremiumViewer,
    totalAvailable: fullSet.length,
    visibleCount,
    refreshesAt: 'next midnight IST',
  });
});

// @route   GET /api/match/likes
// @desc    Get profiles that liked the current user (premium feature)
// @access  Private/Premium
exports.getLikes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  // Members in a block relationship (either direction) never appear in a list.
  const viewerCtx = await loadViewerContext(userId);
  const blockedIds = viewerCtx.blockedIds;
  const viewerPaid = await viewerHasPaidAccess(userId);

  // Get likes with pagination
  const { count, rows: likes } = await Match.findAndCountAll({
    where: {
      matchedUserId: userId,
      action: 'like',
      ...(blockedIds.length ? { userId: { [Op.notIn]: blockedIds } } : {})
    },
    include: [
      {
        model: User,
        as: 'User',
        attributes: ['id'],
        where: { status: 'active' },
        include: [{
          model: Profile,
          where: { isActive: true },
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'photoBlurUntilMatch', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  // What has the viewer already done about each of these likers? getLikes returns every
  // 'like' aimed at them, so without this a person the viewer declined (or liked back)
  // reappears with live Accept/Decline buttons after a restart. Additive: clients that
  // do not read `myAction` are unaffected.
  const likerIds = likes.map(like => like.userId);
  const myRows = likerIds.length
    ? await Match.findAll({
      where: { userId, matchedUserId: likerIds },
      attributes: ['matchedUserId', 'action']
    })
    : [];
  const myActionByLiker = new Map(myRows.map(row => [row.matchedUserId, row.action]));

  // Filter out likes without valid profiles
  const validLikes = likes
    .filter(like => like.User?.Profile)
    .map(like => ({
      userId: like.userId,
      ...redactForViewer(like.User.Profile.toJSON(), { isMutual: viewerCtx.mutualIds.has(like.userId), hasPaidAccess: viewerPaid }),
      likedAt: like.createdAt,
      compatibilityScore: like.compatibilityScore,
      // D3 (additive): the note + liked-item snapshot the liker attached
      note: like.note || null,
      likedItem: like.likedItem || null,
      // 'like' | 'pass' | 'shortlist' | null: the viewer's own action toward this liker
      myAction: myActionByLiker.get(like.userId) || null
    }));

  res.json({
    success: true,
    likes: validLikes,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   GET /api/match/shortlist
// @desc    Get shortlisted profiles
// @access  Private
exports.getShortlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const viewerCtx = await loadViewerContext(userId);
  const blockedIds = viewerCtx.blockedIds;
  const viewerPaid = await viewerHasPaidAccess(userId);

  const { count, rows: shortlisted } = await Match.findAndCountAll({
    where: {
      userId,
      action: 'shortlist',
      ...(blockedIds.length ? { matchedUserId: { [Op.notIn]: blockedIds } } : {})
    },
    include: [
      {
        model: User,
        as: 'MatchedUser',
        attributes: ['id'],
        where: { status: 'active' },
        include: [{
          model: Profile,
          where: { isActive: true, [Op.and]: [matchesOnlyClause(viewerCtx)] },
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'photoBlurUntilMatch', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  const validShortlisted = shortlisted
    .filter(match => match.MatchedUser?.Profile)
    .map(match => ({
      userId: match.matchedUserId,
      ...redactForViewer(match.MatchedUser.Profile.toJSON(), { isMutual: viewerCtx.mutualIds.has(match.matchedUserId), hasPaidAccess: viewerPaid }),
      shortlistedAt: match.createdAt,
      compatibilityScore: match.compatibilityScore
    }));

  res.json({
    success: true,
    shortlisted: validShortlisted,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   GET /api/match/sent
// @desc    Profiles the current user has liked (sent interests) — D3
// @access  Private
exports.getSentInterests = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const viewerCtx = await loadViewerContext(userId);
  const blockedIds = viewerCtx.blockedIds;
  const viewerPaid = await viewerHasPaidAccess(userId);

  const { count, rows: sent } = await Match.findAndCountAll({
    where: {
      userId,
      action: 'like',
      ...(blockedIds.length ? { matchedUserId: { [Op.notIn]: blockedIds } } : {})
    },
    include: [
      {
        model: User,
        as: 'MatchedUser',
        attributes: ['id'],
        where: { status: 'active' },
        include: [{
          model: Profile,
          where: { isActive: true, [Op.and]: [matchesOnlyClause(viewerCtx)] },
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'photoBlurUntilMatch', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  const validSent = sent
    .filter(match => match.MatchedUser?.Profile)
    .map(match => ({
      userId: match.matchedUserId,
      ...redactForViewer(match.MatchedUser.Profile.toJSON(), { isMutual: viewerCtx.mutualIds.has(match.matchedUserId), hasPaidAccess: viewerPaid }),
      likedAt: match.createdAt,
      compatibilityScore: match.compatibilityScore,
      isMutual: match.isMutual,
      note: match.note || null,
      likedItem: match.likedItem || null
    }));

  res.json({
    success: true,
    sent: validSent,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});

// @route   GET /api/match/mutual
// @desc    Get mutual matches
// @access  Private
exports.getMutualMatches = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const viewerCtx = await loadViewerContext(userId);
  const blockedIds = viewerCtx.blockedIds;

  const { count, rows: mutualMatches } = await Match.findAndCountAll({
    where: {
      userId,
      isMutual: true,
      ...(blockedIds.length ? { matchedUserId: { [Op.notIn]: blockedIds } } : {})
    },
    include: [
      {
        model: User,
        as: 'MatchedUser',
        attributes: ['id'],
        where: { status: 'active' },
        include: [{
          model: Profile,
          where: { isActive: true },
          required: false,
          attributes: ['firstName', 'lastName', 'city', 'profilePhoto', 'photoBlurUntilMatch', 'gender', 'dateOfBirth', 'education', 'profession']
        }]
      }
    ],
    order: [['mutualMatchDate', 'DESC']],
    limit,
    offset
  });

  const validMatches = mutualMatches
    .filter(match => match.MatchedUser?.Profile)
    .map(match => ({
      userId: match.matchedUserId,
      firstName: match.MatchedUser.Profile.firstName,
      lastName: match.MatchedUser.Profile.lastName,
      city: match.MatchedUser.Profile.city,
      profilePhoto: match.MatchedUser.Profile.profilePhoto,
      gender: match.MatchedUser.Profile.gender,
      dateOfBirth: match.MatchedUser.Profile.dateOfBirth,
      education: match.MatchedUser.Profile.education,
      profession: match.MatchedUser.Profile.profession,
      matchedAt: match.mutualMatchDate,
      compatibilityScore: match.compatibilityScore
    }));

  res.json({
    success: true,
    mutualMatches: validMatches,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});
