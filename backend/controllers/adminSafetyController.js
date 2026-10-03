/**
 * Admin trust & safety tools: suspicious-account signals, moderation metrics,
 * photo review, bulk status changes and support assignment.
 *
 * Kept apart from adminController so that file stops growing. Every SQL literal
 * here is a constant or goes through sequelize.escape / replacements.
 */

const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { User, Profile, ContactMessage, Verification } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log, logAudit } = require('../middlewares/logger');
const { deleteFromCloudinary } = require('../middlewares/upload');
const { revalidateVerification } = require('../utils/verificationFingerprint');
const { notify } = require('../utils/notifyUser');
const { ADMIN_ROLES, scopesFor } = require('../constants/adminScopes');

const TEST_EMAIL_SQL = `(u.email ILIKE '%@example.com' OR u.email ILIKE '%@loadtest.local' OR u.email ILIKE '%@test.com')`;

// Each signal: a weight and an explanation an admin can act on.
const SIGNALS = {
  duplicatePhoto: { weight: 40, label: 'Uses a photo also used by another account' },
  duplicatePhone: { weight: 35, label: 'Phone number shared with another account' },
  // Weaker than a shared photo: a parent's profile for a child and the child's
  // own can legitimately coincide, so this raises a review, not a ban.
  duplicateIdentity: { weight: 20, label: 'Same name, birth date and gender as another account' },
  massOutreach: { weight: 30, label: '25+ likes in the first 24 hours' },
  messageBlast: { weight: 30, label: 'Messaged 15+ different people in the first 48 hours' },
  reported: { weight: 25, label: 'Reported by 2+ members' },
};

// @route   GET /api/v1/admin/suspicious
// @desc    Accounts matching scam / fake-profile heuristics, highest score first
exports.getSuspicious = asyncHandler(async (req, res) => {
  const includeTest = req.query.includeTest === 'true';
  const rows = await sequelize.query(
    `WITH photo_dupes AS (
       SELECT DISTINCT p."userId"
       FROM "Profiles" p, unnest(p.photos) AS url
       WHERE url IN (
         SELECT url2 FROM (
           SELECT unnest(p2.photos) AS url2, p2."userId" AS uid FROM "Profiles" p2
         ) x WHERE url2 NOT LIKE '%/default-%' GROUP BY url2 HAVING count(DISTINCT uid) > 1
       )
     ),
     phone_dupes AS (
       SELECT id FROM "Users"
       WHERE phone IS NOT NULL AND right(regexp_replace(phone, '\\D', '', 'g'), 10) IN (
         SELECT right(regexp_replace(phone, '\\D', '', 'g'), 10) FROM "Users"
         WHERE phone IS NOT NULL AND length(regexp_replace(phone, '\\D', '', 'g')) >= 10
         GROUP BY 1 HAVING count(*) > 1
       )
     ),
     identity_dupes AS (
       SELECT p."userId" FROM "Profiles" p
       JOIN "Users" pu ON pu.id = p."userId" AND pu.status IN ('active', 'pending')
       WHERE p."dateOfBirth" IS NOT NULL AND btrim(coalesce(p."firstName", '')) <> ''
         AND (lower(btrim(p."firstName")), lower(btrim(coalesce(p."lastName", ''))), p."dateOfBirth", p.gender) IN (
           SELECT lower(btrim(p2."firstName")), lower(btrim(coalesce(p2."lastName", ''))), p2."dateOfBirth", p2.gender
           FROM "Profiles" p2
           JOIN "Users" pu2 ON pu2.id = p2."userId" AND pu2.status IN ('active', 'pending')
           WHERE p2."dateOfBirth" IS NOT NULL AND btrim(coalesce(p2."firstName", '')) <> ''
           GROUP BY 1, 2, 3, 4 HAVING count(DISTINCT p2."userId") > 1
         )
     ),
     outreach AS (
       SELECT u.id FROM "Users" u
       JOIN "Matches" m ON m."userId" = u.id AND m.action = 'like' AND m."createdAt" < u."createdAt" + INTERVAL '24 hours'
       GROUP BY u.id HAVING count(*) >= 25
     ),
     blast AS (
       SELECT u.id FROM "Users" u
       JOIN "Messages" ms ON ms."senderId" = u.id AND ms."createdAt" < u."createdAt" + INTERVAL '48 hours'
       GROUP BY u.id HAVING count(DISTINCT ms."receiverId") >= 15
     ),
     reported AS (
       SELECT "reportedUserId" AS id FROM "Reports"
       WHERE status <> 'dismissed' GROUP BY 1 HAVING count(DISTINCT "reporterId") >= 2
     )
     SELECT u.id, u.email, u.phone, u.status, u."createdAt",
            p."firstName", p."lastName", p.city,
            (u.id IN (SELECT "userId" FROM photo_dupes)) AS "duplicatePhoto",
            (u.id IN (SELECT id FROM phone_dupes))       AS "duplicatePhone",
            (u.id IN (SELECT "userId" FROM identity_dupes)) AS "duplicateIdentity",
            (u.id IN (SELECT id FROM outreach))          AS "massOutreach",
            (u.id IN (SELECT id FROM blast))             AS "messageBlast",
            (u.id IN (SELECT id FROM reported))          AS "reported"
     FROM "Users" u
     LEFT JOIN "Profiles" p ON p."userId" = u.id
     WHERE u.role = 'user' AND u.status IN ('active', 'pending')
       ${includeTest ? '' : `AND NOT ${TEST_EMAIL_SQL}`}
       AND (u.id IN (SELECT "userId" FROM photo_dupes) OR u.id IN (SELECT id FROM phone_dupes)
         OR u.id IN (SELECT "userId" FROM identity_dupes)
         OR u.id IN (SELECT id FROM outreach) OR u.id IN (SELECT id FROM blast)
         OR u.id IN (SELECT id FROM reported))
     LIMIT 300`,
    { type: QueryTypes.SELECT }
  );

  const accounts = rows
    .map((r) => {
      const signals = Object.keys(SIGNALS).filter((k) => r[k]);
      return {
        id: r.id,
        email: r.email,
        phone: r.phone,
        status: r.status,
        createdAt: r.createdAt,
        name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
        city: r.city,
        signals: signals.map((k) => ({ key: k, label: SIGNALS[k].label })),
        score: signals.reduce((sum, k) => sum + SIGNALS[k].weight, 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  res.json({ success: true, accounts });
});

// @route   GET /api/v1/admin/moderation-stats
// @desc    Queue health and per-moderator throughput (last 30 days)
exports.getModerationStats = asyncHandler(async (req, res) => {
  const q = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT });

  const [reports, reportsByMod, verifications, verByMod, support] = await Promise.all([
    q(`SELECT
         count(*) FILTER (WHERE status IN ('pending','reviewing')) AS open,
         COALESCE(round(EXTRACT(EPOCH FROM (now() - min("createdAt") FILTER (WHERE status IN ('pending','reviewing')))) / 3600), 0) AS "oldestOpenHours",
         COALESCE(round(avg(EXTRACT(EPOCH FROM ("reviewedAt" - "createdAt")) / 3600) FILTER (WHERE "reviewedAt" IS NOT NULL AND "reviewedAt" > now() - INTERVAL '30 days')::numeric, 1), 0) AS "avgResolveHours",
         count(*) FILTER (WHERE status = 'dismissed' AND "reviewedAt" > now() - INTERVAL '30 days') AS dismissed30,
         count(*) FILTER (WHERE "reviewedAt" > now() - INTERVAL '30 days') AS handled30
       FROM "Reports"`),
    q(`SELECT r."reviewedBy" AS "adminId", u.email, count(*) AS handled
       FROM "Reports" r JOIN "Users" u ON u.id = r."reviewedBy"
       WHERE r."reviewedAt" > now() - INTERVAL '30 days' GROUP BY 1, 2 ORDER BY handled DESC`),
    q(`SELECT
         count(*) FILTER (WHERE status = 'pending') AS open,
         COALESCE(round(EXTRACT(EPOCH FROM (now() - min("createdAt") FILTER (WHERE status = 'pending'))) / 3600), 0) AS "oldestOpenHours",
         count(*) FILTER (WHERE status = 'rejected' AND "verifiedAt" > now() - INTERVAL '30 days') AS rejected30,
         count(*) FILTER (WHERE status IN ('approved','rejected') AND "verifiedAt" > now() - INTERVAL '30 days') AS handled30
       FROM "Verifications"`),
    q(`SELECT v."verifiedBy" AS "adminId", u.email, count(*) AS handled
       FROM "Verifications" v JOIN "Users" u ON u.id = v."verifiedBy"
       WHERE v."verifiedAt" > now() - INTERVAL '30 days' GROUP BY 1, 2 ORDER BY handled DESC`),
    q(`SELECT
         count(*) FILTER (WHERE status = 'new') AS "newCount",
         count(*) FILTER (WHERE status <> 'resolved') AS open,
         COALESCE(round(avg(EXTRACT(EPOCH FROM ("repliedAt" - "createdAt")) / 3600) FILTER (WHERE "repliedAt" IS NOT NULL AND "repliedAt" > now() - INTERVAL '30 days')::numeric, 1), 0) AS "avgReplyHours",
         count(*) FILTER (WHERE "repliedAt" > now() - INTERVAL '30 days') AS replied30
       FROM "ContactMessages"`),
  ]);

  const n = (v) => Number(v) || 0;
  const rep = reports[0] || {};
  const handled = n(rep.handled30);
  res.json({
    success: true,
    reports: {
      open: n(rep.open),
      oldestOpenHours: n(rep.oldestOpenHours),
      avgResolveHours: n(rep.avgResolveHours),
      handled30: handled,
      // Share of decisions later contested is not recorded; the dismissal rate
      // is the nearest honest proxy for moderators who over-flag.
      dismissRate: handled ? Math.round((n(rep.dismissed30) / handled) * 100) : 0,
      byModerator: reportsByMod.map((r) => ({ ...r, handled: n(r.handled) })),
    },
    verifications: {
      open: n(verifications[0]?.open),
      oldestOpenHours: n(verifications[0]?.oldestOpenHours),
      handled30: n(verifications[0]?.handled30),
      rejectRate: n(verifications[0]?.handled30)
        ? Math.round((n(verifications[0].rejected30) / n(verifications[0].handled30)) * 100)
        : 0,
      byModerator: verByMod.map((r) => ({ ...r, handled: n(r.handled) })),
    },
    support: {
      open: n(support[0]?.open),
      newCount: n(support[0]?.newCount),
      avgReplyHours: n(support[0]?.avgReplyHours),
      replied30: n(support[0]?.replied30),
    },
  });
});

// @route   PUT /api/v1/admin/users/bulk-status   body { ids, status }
// @desc    Change the status of many member accounts at once
exports.bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { ids, status } = req.body || {};
  const allowed = ['active', 'inactive', 'banned', 'pending'];
  if (!allowed.includes(status)) throw createError.badRequest(`status must be one of: ${allowed.join(', ')}`);
  if (!Array.isArray(ids) || !ids.length) throw createError.badRequest('Select at least one account');
  if (ids.length > 200) throw createError.badRequest('At most 200 accounts at a time');
  if (!ids.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))) {
    throw createError.badRequest('Invalid account id');
  }

  // Members only: staff accounts are changed through Admins & Roles.
  const targets = await User.findAll({
    where: { id: { [Op.in]: ids }, role: 'user', status: { [Op.ne]: 'deleted' } },
    attributes: ['id', 'status'],
  });
  const targetIds = targets.filter((u) => u.id !== req.user.id).map((u) => u.id);
  if (targetIds.length) {
    await User.update({ status }, { where: { id: { [Op.in]: targetIds } } });
  }
  logAudit('users_bulk_status_changed', req.user.id, { status, count: targetIds.length, ids: targetIds });

  res.json({ success: true, updated: targetIds.length, skipped: ids.length - targetIds.length });
});

// @route   GET /api/v1/admin/photos?page=
// @desc    Most recently updated profiles with their photos, for manual review
exports.getPhotoQueue = asyncHandler(async (req, res) => {
  const limit = 24;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const { count, rows } = await Profile.findAndCountAll({
    where: sequelize.literal('COALESCE(array_length("Profile"."photos", 1), 0) > 0'),
    include: [{ model: User, attributes: ['id', 'email', 'status'], where: { role: 'user', status: { [Op.in]: ['active', 'pending'] } } }],
    attributes: ['id', 'userId', 'firstName', 'lastName', 'photos', 'profilePhoto', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({
    success: true,
    profiles: rows.map((p) => ({
      userId: p.userId,
      name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.User?.email,
      email: p.User?.email,
      photos: p.photos || [],
      profilePhoto: p.profilePhoto,
      updatedAt: p.updatedAt,
    })),
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
  });
});

// @route   DELETE /api/v1/admin/photos   body { userId, photoUrl, reason }
// @desc    Remove one photo from a profile that breaks the guidelines
exports.removePhoto = asyncHandler(async (req, res) => {
  const { userId, photoUrl } = req.body || {};
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '';
  if (!userId || typeof photoUrl !== 'string' || !photoUrl) throw createError.badRequest('userId and photoUrl are required');

  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) throw createError.notFound('Profile not found');
  const photos = Array.isArray(profile.photos) ? profile.photos : [];
  if (!photos.includes(photoUrl) && profile.profilePhoto !== photoUrl) throw createError.notFound('Photo not found on this profile');

  const remaining = photos.filter((p) => p !== photoUrl);
  profile.photos = remaining;
  if (profile.profilePhoto === photoUrl) profile.profilePhoto = remaining[0] || '';
  const wasMainPhoto = profile.changed('profilePhoto');
  await profile.save();

  // Same follow-through as rejecting a held photo: the file itself goes (it
  // stays reachable at its public URL otherwise), and a changed main photo
  // changes what the verified badge vouched for. Neither may undo the removal.
  deleteFromCloudinary(photoUrl)
    .catch((err) => log.error('Removed photo delete failed', { error: err.message, targetUserId: userId }));
  if (wasMainPhoto) {
    revalidateVerification(userId, { Verification, Profile, notify, log })
      .catch((err) => log.error('Verification re-check failed', { error: err.message, targetUserId: userId }));
  }

  logAudit('photo_removed', req.user.id, { targetUserId: userId, photoUrl, reason });
  await notify(
    userId,
    'photo_removed',
    'A photo was removed from your profile',
    'One of your photos did not meet our photo guidelines and was removed. You can upload a new one anytime.'
  );
  res.json({ success: true, remaining: remaining.length });
});

// @route   GET /api/v1/admin/support-staff
// @desc    Admins who can be assigned a support enquiry
exports.getSupportStaff = asyncHandler(async (req, res) => {
  const admins = await User.findAll({
    where: { role: { [Op.in]: ADMIN_ROLES }, status: 'active' },
    attributes: ['id', 'email', 'role', 'adminPermissions'],
  });
  res.json({
    success: true,
    staff: admins.filter((a) => scopesFor(a).includes('support')).map((a) => ({ id: a.id, email: a.email, role: a.role })),
  });
});

// @route   PUT /api/v1/admin/contact-messages/:id/assign   body { assignedTo | null }
exports.assignContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByPk(req.params.id);
  if (!message) throw createError.notFound('Message not found');

  const { assignedTo } = req.body || {};
  if (assignedTo) {
    const staff = await User.findOne({ where: { id: assignedTo, role: { [Op.in]: ADMIN_ROLES }, status: 'active' }, attributes: ['id', 'role', 'adminPermissions'] });
    if (!staff || !scopesFor(staff).includes('support')) throw createError.badRequest('That person cannot handle support enquiries');
  }
  message.assignedTo = assignedTo || null;
  message.assignedAt = assignedTo ? new Date() : null;
  await message.save();

  logAudit('contact_message_assigned', req.user.id, { id: message.id, assignedTo: assignedTo || null });
  res.json({ success: true, message });
});
