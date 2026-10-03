'use strict';

/**
 * Per-field visibility (audit P2).
 *
 * The profile had one switch for the whole record (`profileVisibility`) plus
 * per-link rules for social handles. Income and birth details are the two
 * groups members most often want to show to a serious match but not to every
 * stranger who browses, so each group now carries its own level:
 *
 *   everyone  shown to any viewer who can see the profile (the default, so no
 *             existing profile changes behaviour)
 *   matches   shown only to mutual matches
 *   hidden    shown to nobody but the owner
 *
 * Stored as Profiles.fieldVisibility JSONB `{ income, birthDetails, contact }`. The rule
 * is applied in the payload (utils/profileVisibility.redactForViewer, getProfile,
 * the kundli report) and search refuses to filter on a hidden income, or a
 * range filter would reveal exactly what the member chose to hide.
 */

const LEVELS = ['everyone', 'matches', 'hidden'];

// group -> the Profile columns it covers.
// dateOfBirth is not covered: clients derive age from it and age is core to
// every match decision. Only the horoscope specifics are groupable.
const GROUPS = {
  income: ['income'],
  birthDetails: ['birthTime', 'placeOfBirth'],
  // Phone number and email, which live on the User row rather than the Profile,
  // so there is no column to null here: unlockContact and getProfile read the
  // level through utils/contactDetails instead.
  contact: [],
};

/** Accept only known groups and levels; anything else is dropped. */
const sanitizeFieldVisibility = (input) => {
  let value = input;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (e) { return {}; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const group of Object.keys(GROUPS)) {
    if (LEVELS.includes(value[group])) out[group] = value[group];
  }
  return out;
};

const levelFor = (fieldVisibility, group) => {
  const level = fieldVisibility && fieldVisibility[group];
  return LEVELS.includes(level) ? level : 'everyone';
};

const canSee = (level, { isMutual = false, isSelf = false } = {}) => {
  if (isSelf) return true;
  if (level === 'hidden') return false;
  if (level === 'matches') return Boolean(isMutual);
  return true;
};

/**
 * Null out, in place, every field the viewer may not see. Works on a serialised
 * profile that still carries `fieldVisibility`.
 */
const applyFieldVisibility = (profile, viewer) => {
  if (!profile) return profile;
  for (const [group, columns] of Object.entries(GROUPS)) {
    if (!canSee(levelFor(profile.fieldVisibility, group), viewer)) {
      for (const column of columns) profile[column] = null;
    }
  }
  return profile;
};

module.exports = { LEVELS, GROUPS, sanitizeFieldVisibility, levelFor, canSee, applyFieldVisibility };
