'use strict';

/**
 * CSV cell encoding for every export (audit P2: formula-injection guard).
 *
 * Two separate problems, both handled here so no export has to remember them:
 *
 *  1. Structure (RFC 4180): a value with a comma, quote or line break is quoted
 *     and inner quotes doubled, so it cannot shift columns or start a new row.
 *  2. Formula injection: Excel, Sheets and LibreOffice run a cell that BEGINS
 *     with = + - @ (and tab or carriage return, which some versions strip
 *     before evaluating) as a formula. A member-controlled value like a name or
 *     city that starts that way would execute on the admin's machine when the
 *     file is opened. Such cells get a leading apostrophe, which the
 *     spreadsheet shows as plain text.
 *
 * Numbers are left alone: a negative amount is data, not a formula, and it is
 * not a string a member can influence.
 */

const FORMULA_LEAD = /^[=+\-@|\t\r]/;

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const raw = String(value);
  const guarded = FORMULA_LEAD.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

const csvRow = (cells) => cells.map(csvCell).join(',');

module.exports = { csvCell, csvRow };
