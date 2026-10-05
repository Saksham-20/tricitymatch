/**
 * Public launch date and the phase the site is in relative to it.
 *
 * One definition, so the banner, the Home strip that yields to it and the
 * partner guide cannot disagree about when we launch. "Today" is the calendar
 * day in India: a visitor in Mohali at 00:30 on 11 October is on launch day
 * even though UTC is still the 10th.
 */

// ISO calendar date, IST. `VITE_LAUNCH_DATE` lets a date slip be a rebuild, not
// a code change; anything that is not YYYY-MM-DD falls back to the real date.
const ENV_DATE = String(import.meta.env?.VITE_LAUNCH_DATE || '').trim();
export const LAUNCH_DATE = /^\d{4}-\d{2}-\d{2}$/.test(ENV_DATE) ? ENV_DATE : '2026-10-11';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const istDay = (now) => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const dayNumber = (isoDate) => Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);

/** "11 October" — day and month only, the year is implied by the countdown. */
export const launchDateLabel = () =>
  new Date(`${LAUNCH_DATE}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * @returns {{ phase: 'before'|'today'|'after', days: number }}
 *   `days` is whole calendar days until launch (0 on the day, negative after).
 */
export const launchPhase = (now = new Date()) => {
  const days = dayNumber(LAUNCH_DATE) - dayNumber(istDay(now));
  if (days > 0) return { phase: 'before', days };
  if (days === 0) return { phase: 'today', days };
  return { phase: 'after', days };
};
