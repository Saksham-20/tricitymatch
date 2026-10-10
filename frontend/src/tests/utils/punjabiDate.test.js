/**
 * FUN-04: Chrome has no Punjabi date data, so Intl printed "11 M10", "Sun" and
 * "2027 M01 10" to Punjabi readers. Punjabi now comes from our own word list;
 * Hindi and English still use Intl, which every browser has.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const lang = vi.hoisted(() => ({ current: 'pa' }));
vi.mock('../../i18n', () => ({
  default: { get resolvedLanguage() { return lang.current; } },
}));

import {
  formatPunjabiDate, formatPunjabiDateTime, calendarParts, isPunjabiLocale, PA_MONTHS_LONG,
} from '../../utils/punjabiDate';
import { launchDateParts } from '../../utils/launchDate';
import { formatDate, formatIstDate, formatDateTime } from '../../utils/formatDate';

// Behave like Chrome's trimmed ICU: Punjabi date words are missing.
const breakPunjabiIntl = () => {
  const realDate = Date.prototype.toLocaleDateString;
  const realString = Date.prototype.toLocaleString;
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locale, ...rest) {
    return /^pa/.test(String(locale)) ? 'M10' : realDate.call(this, locale, ...rest);
  });
  vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (locale, ...rest) {
    return /^pa/.test(String(locale)) ? '2027 M01 10 23:59' : realString.call(this, locale, ...rest);
  });
};

afterEach(() => { vi.restoreAllMocks(); lang.current = 'pa'; });

describe('punjabiDate', () => {
  it('spells day, month and year in Gurmukhi, day first', () => {
    const offerEnd = new Date('2027-01-10T18:29:59.999Z'); // 23:59:59 IST on 10 Jan
    expect(formatPunjabiDate(offerEnd, { timeZone: 'Asia/Kolkata' })).toBe('10 ਜਨ 2027');
    expect(formatPunjabiDate(offerEnd, { timeZone: 'Asia/Kolkata', month: 'long' })).toBe('10 ਜਨਵਰੀ 2027');
    expect(formatPunjabiDate(offerEnd, { timeZone: 'UTC', month: 'long', year: false })).toBe('10 ਜਨਵਰੀ');
    expect(formatPunjabiDateTime(offerEnd, { timeZone: 'Asia/Kolkata' })).toBe('10 ਜਨ 2027, 11:59 PM');
    expect(formatPunjabiDateTime(new Date('2026-10-11T03:35:00Z'), { timeZone: 'Asia/Kolkata', year: false })).toBe('11 ਅਕਤੂ, 9:05 AM');
  });

  it('reads the calendar day in the zone asked for', () => {
    const lateUtc = new Date('2026-10-10T19:00:00Z'); // already 11 Oct in India
    expect(calendarParts(lateUtc, 'Asia/Kolkata')).toMatchObject({ year: 2026, month: 10, day: 11, weekday: 0 });
    expect(calendarParts(lateUtc, 'UTC')).toMatchObject({ day: 10, weekday: 6 });
  });

  it('matches the month names the Punjabi locale files use', () => {
    expect(PA_MONTHS_LONG[9]).toBe('ਅਕਤੂਬਰ');
    expect(isPunjabiLocale('pa-IN')).toBe(true);
    expect(isPunjabiLocale('pa')).toBe(true);
    expect(isPunjabiLocale('en-IN')).toBe(false);
  });
});

describe('launch banner date words', () => {
  it('Punjabi does not depend on the browser having Punjabi data', () => {
    breakPunjabiIntl();
    expect(launchDateParts('pa-IN')).toEqual({ day: '11', month: 'ਅਕਤੂਬਰ', weekday: 'ਐਤਵਾਰ' });
  });

  it('Hindi and English still come from Intl', () => {
    expect(launchDateParts('hi-IN')).toEqual({ day: '11', month: 'अक्टूबर', weekday: 'रविवार' });
    expect(launchDateParts('en-IN')).toEqual({ day: '11', month: 'October', weekday: 'Sunday' });
  });
});

describe('formatDate in Punjabi', () => {
  it('prints real month names even where Intl has none', () => {
    breakPunjabiIntl();
    const offerEnd = '2027-01-10T18:29:59.999Z';
    expect(formatIstDate(offerEnd)).toBe('10 ਜਨ 2027');
    expect(formatDate('2026-10-08T06:00:00Z')).toMatch(/^8 ਅਕਤੂ 2026$/);
    expect(formatDateTime(offerEnd)).not.toMatch(/M\d/);
  });

  it('other languages are unchanged', () => {
    lang.current = 'en';
    expect(formatIstDate('2027-01-10T18:29:59.999Z')).toBe('10 Jan 2027');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});
