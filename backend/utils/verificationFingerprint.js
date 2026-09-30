'use strict';

/**
 * A photo-verification badge vouches for ONE face on ONE profile. It must not
 * survive the profile changing underneath it: swap in a different main photo
 * or change the name and the badge would keep telling everyone "a person
 * checked this" about something nobody checked.
 *
 * At approval we record a fingerprint of the fields the reviewer compared. Any
 * later change to those fields sends the verification back to the review queue
 * and the badge drops until a person looks again.
 */

const crypto = require('crypto');

const dateOnly = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

const norm = (v) => String(v ?? '').trim().toLowerCase();

const fingerprintOf = (profile) => {
  if (!profile) return null;
  const parts = [
    String(profile.profilePhoto || ''),
    norm(profile.firstName),
    norm(profile.lastName),
    dateOnly(profile.dateOfBirth),
    norm(profile.gender),
  ];
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
};

/**
 * Re-check a member's approved verification against their current profile.
 * Returns true when the badge was withdrawn.
 */
const revalidateVerification = async (userId, { Verification, Profile, notify, log }) => {
  const verification = await Verification.findOne({ where: { userId, status: 'approved' } });
  if (!verification || !verification.approvedFingerprint) return false;
  const profile = await Profile.findOne({
    where: { userId },
    attributes: ['profilePhoto', 'firstName', 'lastName', 'dateOfBirth', 'gender'],
  });
  if (!profile || fingerprintOf(profile) === verification.approvedFingerprint) return false;

  verification.status = 'pending';
  verification.adminNotes = 'Re-check needed: the profile photo or name changed after verification.';
  verification.verifiedAt = null;
  verification.verifiedBy = null;
  verification.approvedFingerprint = null;
  await verification.save();

  Promise.resolve(notify(
    userId,
    'system',
    'Your photo verification needs a fresh look',
    'You changed your profile photo or name, so our team will check your verification again. Your verified badge returns once they have.'
  )).catch((err) => log.error('Verification re-check notification failed', { error: err.message }));
  return true;
};

module.exports = { fingerprintOf, revalidateVerification };
