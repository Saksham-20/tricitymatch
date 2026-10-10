'use strict';

/**
 * Calendar days as people in India read them.
 *
 * Staff screens count "joined on 11 Oct" and "today" in India time: a member who
 * signs up at 00:30 IST on 11 October joined on the 11th, even though it is still
 * the 10th in UTC (the server's clock and the database session's day).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** 'YYYY-MM-DD' of the India calendar day that contains `date`. */
const istYmd = (date = new Date()) => new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The instant an India calendar day ('YYYY-MM-DD') begins. */
const istDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:30`);

/** The instant the following India day begins: an exclusive end for `ymd`. */
const istDayEnd = (ymd) => new Date(istDayStart(ymd).getTime() + DAY_MS);

/** When today began in India. */
const istTodayStart = (now = new Date()) => istDayStart(istYmd(now));

module.exports = { istYmd, istDayStart, istDayEnd, istTodayStart, DAY_MS };
