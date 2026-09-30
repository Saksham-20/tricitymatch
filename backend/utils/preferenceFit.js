'use strict';

/**
 * Must-have partner preferences (audit P2).
 *
 * A profile stored partner preferences (age, height, education, profession,
 * city) but every one of them was a soft nudge: nothing separated "I would
 * like" from "I will not consider". `mustHavePreferences` is a list of the
 * criteria a member will not compromise on. Search turns each into a hard
 * filter; everything else stays a score.
 *
 * Rules that keep this from hiding people wrongly:
 *  - a must-have with no value behind it (no age range entered, say) does
 *    nothing: it is dropped, not turned into "match nobody";
 *  - a candidate whose own field is empty is NOT excluded (height, education,
 *    profession, city): not knowing is not the same as not meeting it;
 *  - education is "at least this level"; the others are ranges/sets.
 *
 * Only the searcher's own must-haves apply. Hiding people from someone else's
 * discovery because THEY have must-haves is deliberately not done here: it
 * would silently shrink other members' results and reveal preferences.
 */

const { Op, fn, col, where: sqlWhere } = require('sequelize');
const { normalizeEducation, normalizeProfession } = require('../constants/vocabularies');

const MUST_HAVE_KEYS = ['age', 'height', 'education', 'profession', 'city'];

const EDUCATION_RANK = { school: 1, diploma: 2, bachelor: 3, professional: 3, master: 4, doctorate: 5 };

const sanitizeMustHaves = (input) => {
  let value = input;
  if (typeof value === 'string') {
    // Multipart sends a lone array element as a bare string and an emptied
    // array as ''; a JSON string is what other clients send.
    const text = value.trim();
    if (MUST_HAVE_KEYS.includes(text)) return [text];
    try { value = JSON.parse(text); } catch (e) { return []; }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((k) => MUST_HAVE_KEYS.includes(k)))];
};

const cityList = (profile) => {
  const raw = profile.preferredCity;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => String(c).trim()).filter(Boolean);
};

/**
 * @returns {{ clauses: object[], applied: string[] }} Sequelize where-fragments
 *   to AND into a Profile query, and the must-haves that actually took effect.
 */
const mustHaveClauses = (profile, now = new Date()) => {
  const clauses = [];
  const applied = [];
  const wanted = sanitizeMustHaves(profile && profile.mustHavePreferences);

  for (const key of wanted) {
    if (key === 'age' && (profile.preferredAgeMin || profile.preferredAgeMax)) {
      const dob = {};
      if (profile.preferredAgeMin) dob[Op.lte] = new Date(now.getFullYear() - profile.preferredAgeMin, now.getMonth(), now.getDate());
      if (profile.preferredAgeMax) dob[Op.gt] = new Date(now.getFullYear() - profile.preferredAgeMax - 1, now.getMonth(), now.getDate());
      clauses.push({ dateOfBirth: dob });
      applied.push('age');
    }

    if (key === 'height' && (profile.preferredHeightMin || profile.preferredHeightMax)) {
      const h = {};
      if (profile.preferredHeightMin) h[Op.gte] = profile.preferredHeightMin;
      if (profile.preferredHeightMax) h[Op.lte] = profile.preferredHeightMax;
      clauses.push({ [Op.or]: [{ height: { [Op.is]: null } }, { height: h }] });
      applied.push('height');
    }

    if (key === 'education' && profile.preferredEducation) {
      const rank = EDUCATION_RANK[normalizeEducation(profile.preferredEducation)];
      if (rank) {
        const levels = Object.keys(EDUCATION_RANK).filter((l) => EDUCATION_RANK[l] >= rank);
        clauses.push({ [Op.or]: [{ educationLevel: { [Op.is]: null } }, { educationLevel: { [Op.in]: levels } }] });
        applied.push('education');
      }
    }

    if (key === 'profession' && profile.preferredProfession) {
      const group = normalizeProfession(profile.preferredProfession);
      if (group && group !== 'Other') {
        clauses.push({ [Op.or]: [{ professionGroup: { [Op.is]: null } }, { professionGroup: group }] });
        applied.push('profession');
      }
    }

    if (key === 'city') {
      const cities = cityList(profile);
      if (cities.length) {
        clauses.push({
          [Op.or]: [
            { city: { [Op.is]: null } },
            sqlWhere(fn('LOWER', col('city')), { [Op.in]: cities.map((c) => c.toLowerCase()) }),
          ],
        });
        applied.push('city');
      }
    }
  }
  return { clauses, applied };
};

module.exports = { MUST_HAVE_KEYS, EDUCATION_RANK, sanitizeMustHaves, mustHaveClauses };
