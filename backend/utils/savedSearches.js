'use strict';

/**
 * Saved-search filter sanitisation — single source of truth.
 *
 * The saved-search API carefully whitelists filter keys and caps the list at 5,
 * but `lifestylePreferences` is ALSO a client-editable profile field, so
 * `PUT /profile/me` could write `lifestylePreferences.savedSearches` directly
 * and bypass both. The weekly-digest Bull job then fed those values straight
 * into a Sequelize `where`.
 *
 * That is not SQL injection (Sequelize 6 disables string operator aliases by
 * default), but it is an unbounded, unvalidated path into a server-side query
 * loop — N saved searches x a Profile.count() per user per run — and it made
 * the sanitiser's guarantees illusory. Both writers now share this module.
 */

const MAX_SAVED_SEARCHES = 5;

// Every filter the Search page offers is saved, so opening a saved search
// reproduces what was on screen and the alert counts the same thing.
const FILTER_ENUMS = {
  diet: ['vegetarian', 'non-vegetarian', 'vegan', 'jain'],
  smoking: ['never', 'occasionally', 'regularly'],
  drinking: ['never', 'occasionally', 'regularly'],
  maritalStatus: ['never_married', 'divorced', 'widowed', 'awaiting_divorce'],
  manglikFilter: ['manglik_only', 'non_manglik_only', 'exclude_incompatible'],
  sortBy: ['compatibility', 'age', 'location', 'recent'],
};
const FILTER_TEXT = ['religion', 'caste', 'education', 'profession', 'motherTongue'];
const FILTER_INTS = {
  ageMin: [18, 99], ageMax: [18, 99],
  heightMin: [100, 250], heightMax: [100, 250],
  incomeMin: [0, 100000000], incomeMax: [0, 100000000],
};

const sanitizeSavedFilters = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const filters = {};
  // Kept for stored rows: the alert always searches the opposite gender now.
  if (typeof raw.gender === 'string' && ['male', 'female'].includes(raw.gender)) filters.gender = raw.gender;
  for (const key of FILTER_TEXT) {
    if (typeof raw[key] === 'string' && raw[key].trim()) filters[key] = raw[key].trim().slice(0, 100);
  }
  for (const [key, allowed] of Object.entries(FILTER_ENUMS)) {
    if (typeof raw[key] === 'string' && allowed.includes(raw[key])) filters[key] = raw[key];
  }
  if (raw.verifiedOnly === true || raw.verifiedOnly === 'true') filters.verifiedOnly = 'true';
  if (Array.isArray(raw.city)) {
    const cities = raw.city.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim().slice(0, 60)).slice(0, 10);
    if (cities.length) filters.city = cities;
  } else if (typeof raw.city === 'string' && raw.city.trim()) {
    filters.city = [raw.city.trim().slice(0, 60)];
  }
  for (const [key, [lo, hi]] of Object.entries(FILTER_INTS)) {
    const n = parseInt(raw[key], 10);
    if (Number.isFinite(n) && n >= lo && n <= hi) filters[key] = n;
  }
  for (const [lo, hi] of [['ageMin', 'ageMax'], ['heightMin', 'heightMax'], ['incomeMin', 'incomeMax']]) {
    if (filters[lo] !== undefined && filters[hi] !== undefined && filters[lo] > filters[hi]) delete filters[hi];
  }
  return filters;
};

/**
 * Sanitise a whole savedSearches array (shape + cap), dropping entries whose
 * filters do not survive the whitelist. Used when the array arrives from a
 * generic profile update rather than the dedicated endpoint.
 */
const sanitizeSavedSearchList = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => {
      const filters = sanitizeSavedFilters(entry.filters);
      if (Object.keys(filters).length === 0) return null;
      return {
        id: typeof entry.id === 'string' ? entry.id.slice(0, 64) : undefined,
        name: typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : 'Saved search',
        filters,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt.slice(0, 40) : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_SAVED_SEARCHES);
};

module.exports = { MAX_SAVED_SEARCHES, sanitizeSavedFilters, sanitizeSavedSearchList };
