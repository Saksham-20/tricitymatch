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

const sanitizeSavedFilters = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const filters = {};
  if (typeof raw.gender === 'string' && ['male', 'female'].includes(raw.gender)) filters.gender = raw.gender;
  if (typeof raw.religion === 'string' && raw.religion.trim()) filters.religion = raw.religion.trim().slice(0, 50);
  if (typeof raw.caste === 'string' && raw.caste.trim()) filters.caste = raw.caste.trim().slice(0, 50);
  if (Array.isArray(raw.city)) {
    const cities = raw.city.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim().slice(0, 60)).slice(0, 10);
    if (cities.length) filters.city = cities;
  }
  const ageMin = parseInt(raw.ageMin, 10);
  const ageMax = parseInt(raw.ageMax, 10);
  if (Number.isFinite(ageMin) && ageMin >= 18 && ageMin <= 80) filters.ageMin = ageMin;
  if (Number.isFinite(ageMax) && ageMax >= 18 && ageMax <= 80) filters.ageMax = ageMax;
  if (filters.ageMin && filters.ageMax && filters.ageMin > filters.ageMax) {
    delete filters.ageMax;
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
