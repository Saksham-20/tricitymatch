'use strict';

/**
 * The consent record names the Terms version a member accepted, and the server
 * asks members to accept again when that version moves on. Both only mean
 * something if the version IS the date the legal pages say they were last
 * updated: the later of the Terms and Privacy Policy dates the web app shows.
 *
 * The two used to drift: the pages said 2 and 10 October while every new
 * consent record said 26 August, and nobody was asked to accept the changes.
 */

const fs = require('fs');
const path = require('path');
const { TERMS_VERSION, needsReconsent, ASSISTED_SIGNUP_TERMS } = require('../../constants/legal');

const WEB_CONFIG = path.join(__dirname, '../../../frontend/src/config/index.js');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

// "2 October 2026" -> "2026-10-02"
const isoFromWebDate = (source, key) => {
  const match = source.match(new RegExp(`${key}:\\s*['"](\\d{1,2}) ([A-Za-z]+) (\\d{4})['"]`));
  if (!match) throw new Error(`${key} not found (or not "D Month YYYY") in frontend/src/config/index.js`);
  const [, day, monthName, year] = match;
  const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
  if (!month) throw new Error(`${key}: unknown month "${monthName}"`);
  return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
};

describe('Terms version lockstep', () => {
  const source = fs.readFileSync(WEB_CONFIG, 'utf8');
  const terms = isoFromWebDate(source, 'termsUpdated');
  const privacy = isoFromWebDate(source, 'privacyUpdated');

  it('is the later of the Terms and Privacy "Last updated" dates on the website', () => {
    const later = terms > privacy ? terms : privacy;
    expect(TERMS_VERSION).toBe(later);
  });

  it('asks a member who accepted an earlier version to accept again, but not one with no record', () => {
    // What every consent record said until the version caught up with the pages.
    expect(needsReconsent({ termsVersion: '2026-08-26' })).toBe(true);
    // The Terms date alone: the Privacy Policy changed after it.
    expect(needsReconsent({ termsVersion: '2026-10-02' })).toBe(true);
    expect(needsReconsent({ termsVersion: TERMS_VERSION })).toBe(false);
    expect(needsReconsent({ termsVersion: null })).toBe(false);
    expect(needsReconsent({ termsVersion: ASSISTED_SIGNUP_TERMS })).toBe(true);
  });
});
