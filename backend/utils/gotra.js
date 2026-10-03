'use strict';

/**
 * Gotra comparison, kept in one place so the SQL filter and the profile-page
 * warning cannot disagree about what "the same gotra" means.
 *
 * Gotra is free text on the profile ("Kashyap", "kashyap gotra", "  Kashyap "),
 * so both sides are normalised: lower-case, trimmed, inner spaces collapsed, a
 * trailing word "gotra" removed. An empty or unknown gotra never matches
 * anything: a member who did not say is never hidden or warned about.
 */
const normalizeGotra = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*gotra$/, '')
    .trim();
};

const sameGotra = (a, b) => {
  const x = normalizeGotra(a);
  return x !== '' && x === normalizeGotra(b);
};

/** The same normalisation as a SQL expression over a column reference. */
const gotraSql = (column = '"Profile"."gotra"') =>
  `regexp_replace(btrim(regexp_replace(lower(COALESCE(${column}, '')), '\\s+', ' ', 'g')), '\\s*gotra$', '')`;

module.exports = { normalizeGotra, sameGotra, gotraSql };
