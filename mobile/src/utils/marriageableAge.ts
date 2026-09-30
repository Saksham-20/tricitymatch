// Minimum age to hold a profile: 21 for men, 18 for women (the app offers only
// those two on the basics screens; the server also holds "other" to 21).
// Mirrors backend/constants/marriageableAge.js — the server is the authority.
export const minAgeFor = (gender: string | null | undefined): number => (gender === 'female' ? 18 : 21);

/** Whole years on `today` for an ISO `YYYY-MM-DD` date, calendar-accurate. */
export const ageOnIso = (iso: string, today: Date = new Date()): number => {
  const [y, m, d] = iso.split('-').map(Number);
  let age = today.getFullYear() - y;
  const month = today.getMonth() + 1;
  if (month < m || (month === m && today.getDate() < d)) age -= 1;
  return age;
};
