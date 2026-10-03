'use strict';

/**
 * Search `where` builder — ONE implementation for the Search page and the
 * saved-search alert job.
 *
 * The alert used to rebuild its own query from five whitelisted keys: no
 * opposite-gender default, no blocks, no matches-only rule, no must-haves and a
 * different age calculation, so the count in "3 new profiles match your saved
 * search" could disagree with what opening the search showed. Both now call
 * this, so what is counted is what is listed.
 */

const { Op, fn, col } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../config/database');
const { listingScope } = require('./profileVisibility');
const { mustHaveClauses } = require('./preferenceFit');
const {
  normalizeEducation,
  professionGroupFromFilter,
  PROFESSION_GROUPS,
  normalizeCaste,
  casteFilterKeys,
} = require('../constants/vocabularies');

// Escape special characters for LIKE patterns to prevent injection
const escapeLikePattern = (str) => {
  if (!str) return str;
  return String(str).replace(/[%_\\]/g, '\\$&');
};

const MARITAL_STATUSES = ['never_married', 'divorced', 'widowed', 'awaiting_divorce'];

/**
 * @param {object} filters        the Search filter set (strings from a query string
 *                                or the typed values of a saved search)
 * @param {object} currentProfile the searching member's profile row
 * @param {object} viewerCtx      from loadViewerContext
 * @param {boolean} [mustHavesOff] ignore the member's own must-have preferences
 * @param {boolean} [showPassed]   include members the viewer already passed on
 *        (hidden by default, as daily matches and suggestions already do)
 * @returns {{ where: object, mustHave: { clauses: object[], applied: string[] } }}
 */
const buildSearchWhere = ({ filters = {}, currentProfile, viewerCtx, mustHavesOff = false, showPassed = false }) => {
  const {
    ageMin, ageMax, heightMin, heightMax, city, education, profession,
    diet, smoking, drinking, interestTags, religion, caste, maritalStatus,
    incomeMin, incomeMax, motherTongue, manglikFilter, verifiedOnly,
  } = filters;

  // Who may appear (blocked, incognito, matches-only unless mutual, self, gotra)
  // is one shared rule for every listing — see utils/profileVisibility.
  const where = listingScope(viewerCtx);
  const and = () => { if (!where[Op.and]) where[Op.and] = []; return where[Op.and]; };

  // A profile the viewer passed on stays out of their results, the same rule
  // daily matches and suggestions apply. `showPassed` brings them back.
  if (!showPassed) {
    const viewer = sequelize.escape(viewerCtx.viewerId);
    and().push(Sequelize.literal(`NOT EXISTS (
      SELECT 1 FROM "Matches" pm
      WHERE pm."userId" = ${viewer} AND pm."matchedUserId" = "Profile"."userId" AND pm."action" = 'pass'
    )`));
  }

  // Gender filter: opposite gender when set; otherwise both so results aren't empty
  const gender = (currentProfile.gender || '').toLowerCase();
  if (gender === 'male') where.gender = 'female';
  else if (gender === 'female') where.gender = 'male';
  else where.gender = { [Op.in]: ['male', 'female'] };

  // The searcher's own must-have partner preferences are hard filters. A
  // must-have with no value behind it, and candidates whose own field is blank,
  // are never excluded (utils/preferenceFit).
  const mustHave = mustHavesOff ? { clauses: [], applied: [] } : mustHaveClauses(currentProfile);
  if (mustHave.clauses.length) and().push(...mustHave.clauses);

  // Age filter: dateOfBirth in [now - (ageMax+1) years exclusive, now - ageMin years inclusive]
  // "Age in [25, 35]" → born between 1991-01-01 (exclusive, >25 not >=26) and 2001-01-01 (inclusive, <=35)
  if (ageMin || ageMax) {
    const now = new Date();
    const age_clause = {};
    // Older boundary (youngest in age range): dateOfBirth <= now - ageMin years
    if (ageMin) age_clause[Op.lte] = new Date(now.getFullYear() - ageMin, now.getMonth(), now.getDate());
    // Younger boundary (oldest in age range): dateOfBirth > now - (ageMax+1) years
    if (ageMax) age_clause[Op.gt] = new Date(now.getFullYear() - ageMax - 1, now.getMonth(), now.getDate());
    where.dateOfBirth = age_clause;
  }

  // Height filter
  if (heightMin || heightMax) {
    where.height = {};
    if (heightMin) where.height[Op.gte] = parseInt(heightMin, 10);
    if (heightMax) where.height[Op.lte] = parseInt(heightMax, 10);
  }

  // City filter: a typed place matches by containment; a saved search may carry
  // several cities, any of which will do.
  const cities = (Array.isArray(city) ? city : [city]).filter((c) => typeof c === 'string' && c.trim());
  if (cities.length === 1) {
    where.city = { [Op.iLike]: `%${escapeLikePattern(cities[0])}%` };
  } else if (cities.length > 1) {
    and().push({ [Op.or]: cities.map((c) => ({ city: { [Op.iLike]: `%${escapeLikePattern(c)}%` } })) });
  }

  // Education filter: matches the canonical level, so "Master" also finds
  // "Masters", "M.Tech" and "MBA". Text we cannot classify keeps the exact match.
  if (education) {
    const level = normalizeEducation(education);
    if (level) where.educationLevel = level;
    else where.education = education;
  }

  // Profession filter. A value that IS a group label (the dropdown) selects that
  // group alone: "Engineer" must not also pull in every "Software Engineer".
  // Anything typed is matched as the group it classifies to OR as a contains
  // match, so "Software Engineer" finds the Software / IT group and the people
  // who wrote those exact words.
  if (profession) {
    const label = PROFESSION_GROUPS.find((g) => g.toLowerCase() === String(profession).trim().toLowerCase());
    if (label) {
      where.professionGroup = label;
    } else {
      const group = professionGroupFromFilter(profession);
      const contains = { profession: { [Op.iLike]: `%${escapeLikePattern(profession)}%` } };
      if (group && group !== 'Other') and().push({ [Op.or]: [{ professionGroup: group }, contains] });
      else where.profession = contains.profession;
    }
  }

  // Lifestyle filters
  if (diet) where.diet = diet;
  if (smoking) where.smoking = smoking;
  if (drinking) where.drinking = drinking;

  // Interest tags filter
  if (interestTags) {
    const tags = Array.isArray(interestTags) ? interestTags : [interestTags];
    where.interestTags = { [Op.overlap]: tags };
  }

  // Religion filter (exact case-insensitive match to use LOWER() index)
  if (religion) {
    and().push(Sequelize.where(fn('LOWER', col('religion')), Op.eq, String(religion).toLowerCase()));
  }

  // Caste filter: canonical spelling plus every alias that maps to it, matched
  // whole. Writes canonicalise 'Jat Sikh' to 'Jatt', so a contains-match on the
  // typed text missed one side of every spelling pair and, the other way,
  // 'Bhati' matched 'Bhatia'.
  if (caste) {
    const keys = casteFilterKeys(normalizeCaste(caste));
    if (keys.length) {
      and().push(Sequelize.where(fn('LOWER', fn('btrim', col('caste'))), { [Op.in]: keys }));
    }
  }

  // Marital status filter
  if (maritalStatus && MARITAL_STATUSES.includes(maritalStatus)) {
    where.maritalStatus = maritalStatus;
  }

  // Income filter — parse and validate to prevent NaN being passed to the DB query
  const parsedIncomeMin = incomeMin !== undefined ? parseInt(incomeMin, 10) : NaN;
  const parsedIncomeMax = incomeMax !== undefined ? parseInt(incomeMax, 10) : NaN;
  if (!isNaN(parsedIncomeMin) && parsedIncomeMin >= 0) {
    where.income = { ...(where.income || {}), [Op.gte]: parsedIncomeMin };
  }
  if (!isNaN(parsedIncomeMax) && parsedIncomeMax >= 0) {
    where.income = { ...(where.income || {}), [Op.lte]: parsedIncomeMax };
  }
  if (where.income) {
    // A member who hides their income must not be findable by it: a range
    // filter would reveal exactly what they chose not to show.
    and().push(Sequelize.literal(`COALESCE("Profile"."fieldVisibility"->>'income', 'everyone') = 'everyone'`));
  }

  // Mother tongue filter (exact case-insensitive match to use LOWER() index)
  if (motherTongue) {
    and().push(Sequelize.where(fn('LOWER', col('motherTongue')), Op.eq, String(motherTongue).toLowerCase()));
  }

  // Manglik filter
  if (manglikFilter === 'manglik_only') {
    where.manglikStatus = { [Op.in]: ['manglik', 'anshik_manglik'] };
  } else if (manglikFilter === 'non_manglik_only') {
    where.manglikStatus = 'non_manglik';
  } else if (manglikFilter === 'exclude_incompatible' && currentProfile.manglikStatus) {
    // Exclude profiles that would be incompatible with the current user's manglik status
    if (currentProfile.manglikStatus === 'non_manglik') {
      where.manglikStatus = { [Op.ne]: 'manglik' };
    } else if (currentProfile.manglikStatus === 'manglik') {
      where.manglikStatus = { [Op.in]: ['manglik', 'anshik_manglik', 'not_sure'] };
    }
  }

  // Verified-only filter: restrict to members with an approved photo
  // verification. A correlated EXISTS keeps pagination exact without ever
  // materialising the approved set in application memory (this used to SELECT
  // every approved verification into an IN (...) list — the most DoS-able query
  // in the codebase).
  if (verifiedOnly === 'true' || verifiedOnly === true) {
    and().push(
      Sequelize.literal(`EXISTS (
        SELECT 1 FROM "Verifications" v
        WHERE v."userId" = "Profile"."userId" AND v."status" = 'approved'
      )`)
    );
  }

  return { where, mustHave };
};

module.exports = { buildSearchWhere, escapeLikePattern };
