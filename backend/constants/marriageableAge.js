'use strict';

/**
 * Minimum age to hold a profile — ONE definition for signup, profile update, the
 * model, admin corrections and the underage review script.
 *
 * Prohibition of Child Marriage Act, 2006: 21 for men, 18 for women. The Terms
 * and Privacy pages publish exactly that. The rule used to be a flat 18 in four
 * separate places, so the published rule and the enforced rule disagreed.
 *
 * Owner decision 2026-09-29: gender `other` is held to 21 (the higher bar), and
 * an unknown gender is too — a member cannot dodge the men's threshold by
 * leaving gender blank.
 */

const MIN_AGE_BY_GENDER = { male: 21, female: 18, other: 21 };
const STRICTEST_MIN_AGE = 21;
const MAX_AGE = 120;

const minAgeFor = (gender) => MIN_AGE_BY_GENDER[gender] ?? STRICTEST_MIN_AGE;

/**
 * Whole years on `today`, birthday-accurate (the old `/(365.25 days)` estimate
 * is off by a day around birthdays and leap years — wrong on exactly the
 * boundary this rule exists to enforce). Returns null for an unparseable date.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const ageOn = (dateOfBirth, today = new Date()) => {
  const raw = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(raw.getTime())) return null;
  // Calendar days in India Standard Time: stored birth dates are either UTC
  // midnight or IST midnight of the same day (see utils/identityLock).
  const dob = new Date(raw.getTime() + IST_OFFSET_MS);
  const now = new Date(today.getTime() + IST_OFFSET_MS);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
};

/**
 * @returns {string|null} the reason this (gender, dob) pair is not allowed, or
 *          null when it is fine. A missing DOB is not an error here — callers
 *          decide whether a date is required.
 */
const marriageableAgeProblem = (gender, dateOfBirth, today = new Date()) => {
  if (dateOfBirth === null || dateOfBirth === undefined || dateOfBirth === '') return null;
  const age = ageOn(dateOfBirth, today);
  if (age === null) return 'Invalid date of birth';
  if (age > MAX_AGE) return 'Invalid date of birth';
  const min = minAgeFor(gender);
  if (age < min) return `You must be at least ${min} years old`;
  return null;
};

module.exports = { MIN_AGE_BY_GENDER, STRICTEST_MIN_AGE, minAgeFor, ageOn, marriageableAgeProblem };
