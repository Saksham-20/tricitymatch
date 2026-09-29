'use strict';

/**
 * Date of birth and gender are locked once onboarding is complete.
 *
 * Both feed the marriageable-age rule and how members are matched and shown, so
 * a member who could re-edit them at will could re-enter a different birth date
 * until one passed, or flip gender to dodge the higher threshold. Until
 * onboarding completes they stay editable (that is how they get set); after,
 * only support can change them (see adminController.changeMemberIdentity), and
 * that change is audited.
 *
 * Pure: mutates only the `updateData` it is handed and throws on violation.
 */

const { createError } = require('../middlewares/errorHandler');
const { marriageableAgeProblem } = require('../constants/marriageableAge');

// Calendar day in India Standard Time. Stored dates are a mix of UTC midnight
// (a bare 'YYYY-MM-DD' parsed by the server) and IST midnight (seeded data, dates
// built in a browser or phone in India); read in IST both give the same day, and
// a client that resubmits what it was shown always compares equal.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const dayOf = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
};

const LOCKED_MESSAGE = 'Your date of birth and gender cannot be changed after sign-up. Contact support if one of them is wrong.';

/**
 * @param {object} profile     stored Profile (gender, dateOfBirth, onboardingComplete)
 * @param {object} updateData  the allowlisted, sanitised update about to be written
 */
const applyIdentityRules = (profile, updateData) => {
  const has = (k) => Object.prototype.hasOwnProperty.call(updateData, k);
  const locked = Boolean(profile.onboardingComplete);

  if (has('dateOfBirth')) {
    const stored = dayOf(profile.dateOfBirth);
    const next = dayOf(updateData.dateOfBirth);
    if (locked && stored && next !== stored) throw createError.forbidden(LOCKED_MESSAGE, 'IDENTITY_LOCKED');
    // An unchanged value is a no-op: drop it so a resubmitted form never
    // re-validates (and blocks) a legacy account on a field it did not touch.
    if (stored && next === stored) delete updateData.dateOfBirth;
  }

  if (has('gender')) {
    if (locked && profile.gender && updateData.gender !== profile.gender) {
      throw createError.forbidden(LOCKED_MESSAGE, 'IDENTITY_LOCKED');
    }
    if (profile.gender && updateData.gender === profile.gender) delete updateData.gender;
  }

  if (has('dateOfBirth') || has('gender')) {
    const nextGender = has('gender') ? updateData.gender : profile.gender;
    const nextDob = has('dateOfBirth') ? updateData.dateOfBirth : profile.dateOfBirth;
    const problem = marriageableAgeProblem(nextGender, nextDob);
    if (problem) throw createError.badRequest(problem);
  }
};

module.exports = { applyIdentityRules, LOCKED_MESSAGE, dayOf };
