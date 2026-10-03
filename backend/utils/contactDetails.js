'use strict';

/**
 * What a member's contact details are, and who may be given them.
 *
 * Two questions live here so unlockContact and getProfile cannot disagree:
 *   1. which number do we hand out?  (revealablePhone)
 *   2. is this viewer allowed one?   (contactShareFor)
 */
const { levelFor, canSee } = require('../constants/fieldVisibility');
const { isMutualMatch } = require('./entitlements');

/**
 * The number to reveal: the separately verified contact number if the member
 * set one, otherwise the login number, but only when that is verified. A number
 * the owner never proved they control is never revealed.
 */
const revealablePhone = (user) => {
  if (!user) return null;
  if (user.contactPhone) return user.contactPhone;
  return user.phoneVerified && user.phone ? user.phone : null;
};

/** `{ phone, email }` as returned from an unlock. */
const contactOf = (user) => ({
  phone: revealablePhone(user),
  email: user?.email || null,
});

/**
 * The owner's choice applied to one viewer.
 * Returns `{ level, allowed, reason }`; `reason` is an error code when blocked.
 */
const contactShareFor = async (ownerFieldVisibility, ownerId, viewerId) => {
  const level = levelFor(ownerFieldVisibility, 'contact');
  if (level === 'everyone') return { level, allowed: true, reason: null };
  const isMutual = level === 'matches' ? await isMutualMatch(viewerId, ownerId) : false;
  const allowed = canSee(level, { isMutual });
  return {
    level,
    allowed,
    reason: allowed ? null : (level === 'hidden' ? 'CONTACT_NOT_SHARED' : 'CONTACT_MATCHES_ONLY'),
  };
};

module.exports = { revealablePhone, contactOf, contactShareFor };
