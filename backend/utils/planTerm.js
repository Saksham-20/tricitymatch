/**
 * When a paid plan ends.
 *
 * Plans are sold in months ("3 months of full access") but stored as a
 * duration in days (30/90/180/360, admin-editable). Counting days made a
 * 3-month plan bought on 9 Oct end on 7 Jan, two days short of what a family
 * reading a calendar expects. A duration that is a whole number of 30-day
 * months now runs to the same date that many calendar months later; any other
 * duration (a 7-day grant) is still counted in days.
 *
 * Months are counted on the India calendar date, and a day that does not exist
 * in the end month is clamped to that month's last day (30 Nov + 3 months =
 * 28 Feb, never 2 March).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const wholeMonths = (days) => (
  Number.isInteger(days) && days > 0 && days % 30 === 0 ? days / 30 : null
);

const addCalendarMonths = (start, months) => {
  // Shift into India time so the "same date" is the date the member saw.
  const ist = new Date(start.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = new Date(ist.getTime());
  end.setUTCFullYear(year, month, Math.min(ist.getUTCDate(), lastDay));
  return new Date(end.getTime() - IST_OFFSET_MS);
};

const planEndDate = (start, durationDays) => {
  const from = start instanceof Date ? start : new Date(start);
  const months = wholeMonths(Number(durationDays));
  if (months) return addCalendarMonths(from, months);
  return new Date(from.getTime() + Number(durationDays) * DAY_MS);
};

module.exports = { planEndDate, addCalendarMonths };
