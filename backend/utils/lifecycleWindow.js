'use strict';

/**
 * When a lifecycle mail is allowed to leave, and which moment of the day a
 * given member's copy is scheduled for.
 *
 * Two problems this exists to stop:
 *
 *  1. Mail at 3 a.m. The hourly job ran around the clock, so a nudge landed
 *     whenever the clock happened to tick over. Nothing here goes before
 *     10:00 or after 22:00 India time.
 *  2. Everyone getting the same mail at the same minute, every day. Each
 *     member (and each kind of mail to that member) is given its own slot
 *     inside the window, derived from a hash of an id — so the spread is
 *     random-looking across members, but STABLE for one member. A per-run coin
 *     flip would make "is this member due?" different on every 30-minute tick
 *     and quietly change how many people get mailed.
 *
 * India has no daylight saving, so IST is a fixed +05:30 and needs no tz
 * database.
 */

const crypto = require('crypto');

const IST_OFFSET_MIN = 330;
const DAY_MIN = 24 * 60;

const WINDOW_OPEN = 10 * 60;        // 10:00 IST — nothing before this
const SLOT_LAST = 21 * 60 + 30;     // latest minute a slot can be assigned
const WINDOW_CLOSE = 22 * 60;       // 22:00 IST — hard stop, "til about 10 pm"

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const minuteOfDayIST = (date = new Date()) =>
  (date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MIN) % DAY_MIN;

const inSendWindow = (date = new Date()) => {
  const m = minuteOfDayIST(date);
  return m >= WINDOW_OPEN && m < WINDOW_CLOSE;
};

const hash32 = (seed) =>
  crypto.createHash('sha256').update(String(seed)).digest().readUInt32BE(0);

// Minute-of-day (IST) this seed is scheduled for, inside [10:00, 21:30].
const slotMinute = (seed) =>
  WINDOW_OPEN + (hash32(`slot:${seed}`) % (SLOT_LAST - WINDOW_OPEN + 1));

// True once the window is open AND this seed's slot has arrived today. The job
// ticks every 30 minutes, so a mail goes out on the first tick at or after its
// slot — never before it, never outside the window.
const isDue = (seed, date = new Date()) =>
  inSendWindow(date) && minuteOfDayIST(date) >= slotMinute(seed);

// Whole hours in [minHours, maxHours], fixed per seed. Used to vary how long
// after an event a mail waits, so two members who did the same thing on the
// same afternoon are not both mailed at the same offset.
const jitterHours = (seed, minHours, maxHours) =>
  minHours + (hash32(`jitter:${seed}`) % (maxHours - minHours + 1));

module.exports = {
  WINDOW_OPEN,
  WINDOW_CLOSE,
  HOUR_MS,
  DAY_MS,
  minuteOfDayIST,
  inSendWindow,
  slotMinute,
  isDue,
  jitterHours,
};
