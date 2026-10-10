/**
 * Punjabi (Gurmukhi) date words that do not depend on the browser's Intl data.
 *
 * Chrome ships a trimmed ICU with no Punjabi calendar names, so
 * toLocaleDateString('pa-IN', …) prints "M10", "Sun" and "2027 M01 10" there,
 * while Safari and Firefox print real words. These are CLDR's own Punjabi
 * names, the ones Safari prints, so every browser now shows the same text.
 * Digits stay Western, as CLDR's Punjabi formats do.
 */

export const PA_MONTHS_LONG = [
  'ਜਨਵਰੀ', 'ਫ਼ਰਵਰੀ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈਲ', 'ਮਈ', 'ਜੂਨ',
  'ਜੁਲਾਈ', 'ਅਗਸਤ', 'ਸਤੰਬਰ', 'ਅਕਤੂਬਰ', 'ਨਵੰਬਰ', 'ਦਸੰਬਰ',
];

export const PA_MONTHS_SHORT = [
  'ਜਨ', 'ਫ਼ਰ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈ', 'ਮਈ', 'ਜੂਨ',
  'ਜੁਲਾ', 'ਅਗ', 'ਸਤੰ', 'ਅਕਤੂ', 'ਨਵੰ', 'ਦਸੰ',
];

// Sunday first, matching Date#getUTCDay().
export const PA_WEEKDAYS_LONG = [
  'ਐਤਵਾਰ', 'ਸੋਮਵਾਰ', 'ਮੰਗਲਵਾਰ', 'ਬੁੱਧਵਾਰ', 'ਵੀਰਵਾਰ', 'ਸ਼ੁੱਕਰਵਾਰ', 'ਸ਼ਨੀਵਾਰ',
];

/** 'pa', 'pa-IN', 'pa-Guru-IN' … */
export const isPunjabiLocale = (locale) => /^pa(-|$)/i.test(String(locale || ''));

/**
 * The calendar fields of `date` as numbers, in `timeZone` (the browser's own
 * zone when omitted). Read through en-US numeric parts, which every ICU build
 * formats correctly.
 */
export const calendarParts = (date, timeZone) => {
  const options = {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  };
  if (timeZone) options.timeZone = timeZone;
  const parts = {};
  new Intl.DateTimeFormat('en-US', options).formatToParts(date).forEach(({ type, value }) => {
    parts[type] = Number(value);
  });
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    // Some engines print midnight as 24 under h23.
    hour: parts.hour % 24,
    minute: parts.minute,
    weekday: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(),
  };
};

/**
 * "10 ਜਨ 2027" (short month) or "11 ਅਕਤੂਬਰ 2026" (long month): day first, as
 * the other languages print it.
 */
export const formatPunjabiDate = (date, { month = 'short', year = true, timeZone } = {}) => {
  const p = calendarParts(date, timeZone);
  const name = (month === 'long' ? PA_MONTHS_LONG : PA_MONTHS_SHORT)[p.month - 1];
  return year ? `${p.day} ${name} ${p.year}` : `${p.day} ${name}`;
};

/** "10 ਜਨ 2027, 11:59 PM" ("10 ਜਨ, 11:59 PM" with `year: false`) */
export const formatPunjabiDateTime = (date, { timeZone, year = true } = {}) => {
  const p = calendarParts(date, timeZone);
  const hour12 = p.hour % 12 || 12;
  const minute = String(p.minute).padStart(2, '0');
  return `${formatPunjabiDate(date, { timeZone, year })}, ${hour12}:${minute} ${p.hour < 12 ? 'AM' : 'PM'}`;
};
