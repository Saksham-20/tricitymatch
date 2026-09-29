'use strict';

/**
 * Per-member notification choices. A category set to false suppresses that kind
 * of notice on every channel we control (in-app row, realtime toast, push and
 * email). Safety, security, payment and verification notices are NOT categories:
 * a member cannot opt out of being told their account or money changed.
 */

const CATEGORIES = ['matches', 'interests', 'messages', 'profileViews', 'promotions'];

const DEFAULTS = Object.freeze({
  matches: true,
  interests: true,
  messages: true,
  profileViews: true,
  promotions: false,
});

/** Merge stored prefs over the defaults; ignores unknown keys and non-booleans. */
const resolvePrefs = (stored) => {
  const out = { ...DEFAULTS };
  if (stored && typeof stored === 'object') {
    for (const key of CATEGORIES) {
      if (typeof stored[key] === 'boolean') out[key] = stored[key];
    }
  }
  return out;
};

/** Validate an update body. Returns { ok, prefs } or { ok:false, error }. */
const validatePrefsUpdate = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Preferences must be an object' };
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    if (!CATEGORIES.includes(key)) return { ok: false, error: `Unknown preference "${key}"` };
    if (typeof value !== 'boolean') return { ok: false, error: `Preference "${key}" must be true or false` };
    patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'No preferences given' };
  return { ok: true, patch };
};

const isEnabled = (stored, category) => (category ? resolvePrefs(stored)[category] !== false : true);

module.exports = { CATEGORIES, DEFAULTS, resolvePrefs, validatePrefsUpdate, isEnabled };
