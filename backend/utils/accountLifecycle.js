'use strict';

/**
 * Pausing a profile and scheduling an account deletion (audit P2, P8-05).
 *
 * Until now the only choices were "everyone can see me" and "erase everything
 * immediately". Members who want a break (a match is being discussed, a family
 * event) had to delete, and a mistaken or coerced delete was final the moment it
 * was pressed.
 *
 *   pause    hides the profile from every listing (Profile.isActive = false is
 *            already the single "listable" switch each listing honours) and
 *            records when. The member can still sign in and resume.
 *   schedule sets a grace period (ACCOUNT_DELETION_GRACE_DAYS, default 30). The
 *            profile is hidden straight away; signing in and cancelling restores
 *            it; a daily job erases accounts whose date has passed.
 *
 * Immediate erasure (DELETE /auth/account) is unchanged and still available.
 */

const { Op } = require('sequelize');
const config = require('../config/env');
const { log, logAudit } = require('../middlewares/logger');

const DAY_MS = 24 * 60 * 60 * 1000;
const models = () => require('../models');

const pauseProfile = async (userId) => {
  const { Profile } = models();
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) return { changed: false, reason: 'no_profile' };
  if (profile.pausedAt) return { changed: false, pausedAt: profile.pausedAt };
  const pausedAt = new Date();
  await profile.update({ isActive: false, pausedAt });
  logAudit('profile_paused', userId, {});
  return { changed: true, pausedAt };
};

/** Refused while a deletion is scheduled: cancel that first. */
const resumeProfile = async (userId) => {
  const { Profile, User } = models();
  const user = await User.findByPk(userId, { attributes: ['id', 'deletionScheduledFor'] });
  if (user && user.deletionScheduledFor) return { changed: false, reason: 'deletion_scheduled' };
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) return { changed: false, reason: 'no_profile' };
  if (!profile.pausedAt && profile.isActive) return { changed: false };
  await profile.update({ isActive: true, pausedAt: null });
  logAudit('profile_resumed', userId, {});
  return { changed: true };
};

/**
 * Returns { immediate: true } when the grace period is 0 (caller erases now),
 * otherwise { scheduledFor }.
 */
const scheduleDeletion = async (user) => {
  const { Profile } = models();
  const days = Number(config.account.deletionGraceDays) || 0;
  if (days <= 0) return { immediate: true };
  const scheduledFor = new Date(Date.now() + days * DAY_MS);
  await user.update({ deletionScheduledFor: scheduledFor });
  // Hidden from the moment of the request. pausedAt is left as it was so a
  // cancellation knows whether the member had paused before scheduling.
  await Profile.update({ isActive: false }, { where: { userId: user.id } });
  logAudit('account_deletion_scheduled', user.id, { scheduledFor: scheduledFor.toISOString() });
  return { immediate: false, scheduledFor };
};

const cancelDeletion = async (user) => {
  const { Profile } = models();
  if (!user.deletionScheduledFor) return { changed: false };
  await user.update({ deletionScheduledFor: null });
  const profile = await Profile.findOne({ where: { userId: user.id } });
  if (profile) await profile.update({ isActive: !profile.pausedAt });
  logAudit('account_deletion_cancelled', user.id, {});
  return { changed: true };
};

/**
 * Erase accounts whose grace period has ended. Capped per run and isolated per
 * account: one failure must not stop the others, and a failed erasure is left
 * scheduled so the next run retries it.
 */
const runScheduledDeletions = async ({ limit = 50, now = new Date() } = {}) => {
  const { User } = models();
  const { eraseAccount } = require('./accountErasure');
  const due = await User.findAll({
    where: { deletionScheduledFor: { [Op.lte]: now }, status: { [Op.ne]: 'deleted' } },
    attributes: ['id'],
    order: [['deletionScheduledFor', 'ASC']],
    limit,
  });
  let erased = 0;
  let failed = 0;
  for (const { id } of due) {
    try {
      const result = await eraseAccount(id);
      logAudit('account_erased_after_grace', id, {});
      if (result && result.mediaFailed && result.mediaFailed.length) {
        log.error('Erasure left media files behind', { userId: id, files: result.mediaFailed });
      }
      erased += 1;
    } catch (error) {
      failed += 1;
      log.error('Scheduled erasure failed; will retry next run', { userId: id, error: error.message });
    }
  }
  return { due: due.length, erased, failed };
};

module.exports = { pauseProfile, resumeProfile, scheduleDeletion, cancelDeletion, runScheduledDeletions };
