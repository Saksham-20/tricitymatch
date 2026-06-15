/**
 * Numerology — life-path number from date of birth + a simple pairwise
 * compatibility read. Lightweight, deterministic, no external data. Used as an
 * astro add-on alongside Ashtakoot guna milan (see utils/compatibility.js).
 *
 * Life path = reduce the digits of YYYY + MM + DD to a single digit, preserving
 * the master numbers 11, 22, 33 (standard Pythagorean convention).
 */

// Reduce a number to a single digit, keeping master numbers 11/22/33.
const reduceToCore = (n) => {
  let x = Math.abs(parseInt(n, 10) || 0);
  while (x > 9 && x !== 11 && x !== 22 && x !== 33) {
    x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  }
  return x;
};

const LIFE_PATH_MEANINGS = {
  1: { title: 'The Leader', summary: 'Independent, driven and pioneering — happiest setting the direction.' },
  2: { title: 'The Peacemaker', summary: 'Caring, intuitive and diplomatic — thrives on harmony and partnership.' },
  3: { title: 'The Communicator', summary: 'Expressive, social and creative — brings warmth and optimism.' },
  4: { title: 'The Builder', summary: 'Grounded, loyal and hardworking — values stability and routine.' },
  5: { title: 'The Free Spirit', summary: 'Adventurous, curious and adaptable — needs freedom and variety.' },
  6: { title: 'The Nurturer', summary: 'Responsible, family-minded and protective — a natural caregiver.' },
  7: { title: 'The Seeker', summary: 'Thoughtful, spiritual and analytical — values depth and quiet.' },
  8: { title: 'The Achiever', summary: 'Ambitious, practical and resilient — focused on goals and security.' },
  9: { title: 'The Humanitarian', summary: 'Compassionate, idealistic and generous — gives selflessly.' },
  11: { title: 'The Visionary', summary: 'Master number — inspired, sensitive and intuitive; an old soul.' },
  22: { title: 'The Master Builder', summary: 'Master number — turns big dreams into lasting reality.' },
  33: { title: 'The Master Teacher', summary: 'Master number — devoted to uplifting and guiding others.' },
};

// dateOfBirth (Date | ISO string) → { number, title, summary } or null.
const getLifePath = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  // Reduce each component, then the sum (preserves master numbers along the way).
  const number = reduceToCore(reduceToCore(y) + reduceToCore(m) + reduceToCore(day));
  const meaning = LIFE_PATH_MEANINGS[number] || { title: '', summary: '' };
  return { number, title: meaning.title, summary: meaning.summary };
};

// Pairwise compatibility between two life-path numbers (master numbers folded
// to their root for the comparison). Returns { score 0-100, label, note }.
const fold = (n) => (n === 11 ? 2 : n === 22 ? 4 : n === 33 ? 6 : n);

const numerologyCompatibility = (a, b) => {
  if (!a || !b) return null;
  const x = fold(a), y = fold(b);

  // Harmony groups loosely follow traditional numerology pairings.
  const mind = new Set([3, 6, 9]);
  const creative = new Set([3, 5, 6]);
  const business = new Set([1, 8, 4]);
  const spiritual = new Set([2, 7, 9]);

  let score;
  if (x === y) score = 82;
  else if ([mind, creative, business, spiritual].some((g) => g.has(x) && g.has(y))) score = 88;
  else if (Math.abs(x - y) === 1) score = 70;
  else if ((x + y) % 2 === 0) score = 64;
  else score = 56;

  const label = score >= 85 ? 'Highly compatible'
    : score >= 70 ? 'Compatible'
    : score >= 60 ? 'Workable with effort'
    : 'Complementary opposites';

  const note = x === y
    ? 'Shared life path — you naturally understand each other’s rhythms.'
    : 'Different life paths that can balance each other well.';

  return { score, label, note };
};

// Convenience: full numerology block for two profiles' DOBs.
const getNumerologyMatch = (dob1, dob2) => {
  const person1 = getLifePath(dob1);
  const person2 = getLifePath(dob2);
  if (!person1 || !person2) return null;
  return {
    person1,
    person2,
    compatibility: numerologyCompatibility(person1.number, person2.number),
  };
};

module.exports = {
  reduceToCore,
  getLifePath,
  numerologyCompatibility,
  getNumerologyMatch,
  LIFE_PATH_MEANINGS,
};
