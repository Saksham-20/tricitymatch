/**
 * Compatibility Calculator — Vedic Ashtakoot Guna Milan + lifestyle scoring
 */

const { normalizeEducation } = require('../constants/vocabularies');
const { EDUCATION_RANK } = require('./preferenceFit');

// ─── Vedic Ashtakoot System ──────────────────────────────────────────────────
// Guna Milan scores eight "kootas" out of 36:
//   varna 1 · vashya 2 · tara 3 · yoni 4 · graha maitri 5 · gana 6 · bhakoot 7 · nadi 8
//
// Four are read from the MOON SIGN (varna, vashya, graha maitri, bhakoot) and
// four from the BIRTH STAR / nakshatra (tara, yoni, gana, nadi). A member's
// stored rashi is used for the first group when both sides have one; otherwise
// it is derived from the nakshatra (majority-pada sign, see NAKSHATRA_DATA).
//
// Three kootas are DIRECTIONAL (varna, vashya, gana): the table is read with
// the groom on one axis and the bride on the other. Callers that know gender
// should go through getKundliMatch(), which orders the pair for them.
//
// Traditions differ on several half-point cells (vashya, graha maitri, the
// gana Deva/Rakshasa cell) and on cancellation rules. This module applies one
// widely published set and every figure is INDICATIVE — a family pandit may
// read a pair differently.

// Order matters: index = position in the 27-star cycle (used by Tara).
// nadi follows the standard zig-zag Adi, Madhya, Antya, Antya, Madhya, Adi.
// rashi = the sign holding most of the star's four padas (0 = Mesha).
const NAKSHATRA_DATA = {
  ashwini:           { yoni: 'horse',    gana: 'deva',     nadi: 'adi',    rashi: 0 },
  bharani:           { yoni: 'elephant', gana: 'manushya', nadi: 'madhya', rashi: 0 },
  krittika:          { yoni: 'goat',     gana: 'rakshasa', nadi: 'antya',  rashi: 1 },
  rohini:            { yoni: 'serpent',  gana: 'manushya', nadi: 'antya',  rashi: 1 },
  mrigashira:        { yoni: 'serpent',  gana: 'deva',     nadi: 'madhya', rashi: 1 },
  ardra:             { yoni: 'dog',      gana: 'manushya', nadi: 'adi',    rashi: 2 },
  punarvasu:         { yoni: 'cat',      gana: 'deva',     nadi: 'adi',    rashi: 2 },
  pushya:            { yoni: 'goat',     gana: 'deva',     nadi: 'madhya', rashi: 3 },
  ashlesha:          { yoni: 'cat',      gana: 'rakshasa', nadi: 'antya',  rashi: 3 },
  magha:             { yoni: 'rat',      gana: 'rakshasa', nadi: 'antya',  rashi: 4 },
  purva_phalguni:    { yoni: 'rat',      gana: 'manushya', nadi: 'madhya', rashi: 4 },
  uttara_phalguni:   { yoni: 'cow',      gana: 'manushya', nadi: 'adi',    rashi: 5 },
  hasta:             { yoni: 'buffalo',  gana: 'deva',     nadi: 'adi',    rashi: 5 },
  chitra:            { yoni: 'tiger',    gana: 'rakshasa', nadi: 'madhya', rashi: 5 },
  swati:             { yoni: 'buffalo',  gana: 'deva',     nadi: 'antya',  rashi: 6 },
  vishakha:          { yoni: 'tiger',    gana: 'rakshasa', nadi: 'antya',  rashi: 6 },
  anuradha:          { yoni: 'rabbit',   gana: 'deva',     nadi: 'madhya', rashi: 7 },
  jyeshtha:          { yoni: 'rabbit',   gana: 'rakshasa', nadi: 'adi',    rashi: 7 },
  moola:             { yoni: 'dog',      gana: 'rakshasa', nadi: 'adi',    rashi: 8 },
  purva_ashadha:     { yoni: 'monkey',   gana: 'manushya', nadi: 'madhya', rashi: 8 },
  uttara_ashadha:    { yoni: 'mongoose', gana: 'manushya', nadi: 'antya',  rashi: 9 },
  shravana:          { yoni: 'monkey',   gana: 'deva',     nadi: 'antya',  rashi: 9 },
  dhanistha:         { yoni: 'lion',     gana: 'rakshasa', nadi: 'madhya', rashi: 9 },
  shatabhisha:       { yoni: 'horse',    gana: 'rakshasa', nadi: 'adi',    rashi: 10 },
  purva_bhadrapada:  { yoni: 'lion',     gana: 'manushya', nadi: 'adi',    rashi: 10 },
  uttara_bhadrapada: { yoni: 'cow',      gana: 'deva',     nadi: 'madhya', rashi: 11 },
  revati:            { yoni: 'elephant', gana: 'deva',     nadi: 'antya',  rashi: 11 },
};
const NAKSHATRA_ORDER = Object.keys(NAKSHATRA_DATA);

// Nakshatra aliases (common alternate spellings)
const NAKSHATRA_ALIASES = {
  'ashwini': 'ashwini', 'aswini': 'ashwini', 'ashvini': 'ashwini',
  'bharani': 'bharani',
  'krittika': 'krittika', 'krithika': 'krittika', 'kritika': 'krittika',
  'rohini': 'rohini',
  'mrigashira': 'mrigashira', 'mrigasira': 'mrigashira', 'mrigashirsha': 'mrigashira',
  'ardra': 'ardra', 'aridra': 'ardra',
  'punarvasu': 'punarvasu',
  'pushya': 'pushya', 'pushyami': 'pushya',
  'ashlesha': 'ashlesha', 'aslesha': 'ashlesha',
  'magha': 'magha', 'makha': 'magha',
  'purva_phalguni': 'purva_phalguni', 'purva phalguni': 'purva_phalguni', 'purva': 'purva_phalguni',
  'uttara_phalguni': 'uttara_phalguni', 'uttara phalguni': 'uttara_phalguni',
  'hasta': 'hasta',
  'chitra': 'chitra', 'chitta': 'chitra',
  'swati': 'swati', 'svati': 'swati',
  'vishakha': 'vishakha', 'visakha': 'vishakha',
  'anuradha': 'anuradha',
  'jyeshtha': 'jyeshtha', 'jyeshta': 'jyeshtha', 'kettai': 'jyeshtha',
  'moola': 'moola', 'mula': 'moola',
  'purva_ashadha': 'purva_ashadha', 'purva ashadha': 'purva_ashadha', 'poorvashadha': 'purva_ashadha',
  'uttara_ashadha': 'uttara_ashadha', 'uttara ashadha': 'uttara_ashadha',
  'shravana': 'shravana', 'sravana': 'shravana', 'shravan': 'shravana',
  'dhanistha': 'dhanistha', 'dhanishtha': 'dhanistha', 'dhanista': 'dhanistha', 'dhanishta': 'dhanistha',
  'shatabhisha': 'shatabhisha', 'satabhisha': 'shatabhisha', 'sadayam': 'shatabhisha',
  'purva_bhadrapada': 'purva_bhadrapada', 'purva bhadrapada': 'purva_bhadrapada',
  'uttara_bhadrapada': 'uttara_bhadrapada', 'uttara bhadrapada': 'uttara_bhadrapada',
  'revati': 'revati',
};

const nakshatraKey = (name) => {
  if (!name || typeof name !== 'string') return null;
  const key = name.toLowerCase().trim();
  const canonical = NAKSHATRA_ALIASES[key] || key;
  return NAKSHATRA_DATA[canonical] ? canonical : null;
};

const resolveNakshatra = (name) => {
  const key = nakshatraKey(name);
  return key ? NAKSHATRA_DATA[key] : null;
};

// ─── Rashi (moon sign) parsing ───────────────────────────────────────────────
// Accepts what the editor stores ("Mesha", "Vrishchika") and the English names
// ("Aries", "Mesha (Aries)", "Mesh").
const RASHI_PREFIXES = [
  ['mesh', 0], ['aries', 0],
  ['vrishabh', 1], ['taurus', 1], ['vrishab', 1],
  ['mithun', 2], ['gemini', 2],
  ['kark', 3], ['cancer', 3],
  ['simh', 4], ['leo', 4],
  ['kany', 5], ['virgo', 5],
  ['tula', 6], ['libra', 6],
  ['vrishchik', 7], ['scorpio', 7], ['vrischik', 7],
  ['dhan', 8], ['sagittarius', 8],
  ['makar', 9], ['capricorn', 9],
  ['kumbh', 10], ['aquarius', 10],
  ['meen', 11], ['pisces', 11],
];

const resolveRashi = (name) => {
  if (!name || typeof name !== 'string') return null;
  const first = name.toLowerCase().trim().split(/[\s(]/)[0];
  if (!first) return null;
  for (const [prefix, idx] of RASHI_PREFIXES) {
    if (first.startsWith(prefix)) return idx;
  }
  return null;
};

// ─── Guna 1: Varna (1 point) ─────────────────────────────────────────────────
// Brahmin 4 (Karka, Vrishchika, Meena) · Kshatriya 3 (Mesha, Simha, Dhanu)
// Vaishya 2 (Vrishabha, Kanya, Makara) · Shudra 1 (Mithuna, Tula, Kumbha)
// Full point when the groom's varna is equal to or higher than the bride's.
const RASHI_VARNA = [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4];
const getVarnaScore = (groomRashi, brideRashi) =>
  (RASHI_VARNA[groomRashi] >= RASHI_VARNA[brideRashi] ? 1 : 0);

// ─── Guna 2: Vashya (2 points) ───────────────────────────────────────────────
// Sign categories: Chatushpada (quadruped), Manava (human), Jalachara
// (water), Vanachara (wild), Keeta (insect). Dhanu and Makara are split by
// pada in some texts; the majority category is used for each.
const VASHYA_GROUP = [0, 0, 1, 2, 3, 1, 1, 4, 1, 0, 1, 2];
// [bride row][groom column], order Chatushpada, Manava, Jalachara, Vanachara, Keeta
const VASHYA_MATRIX = [
  [2, 1, 1, 1.5, 1],
  [1, 2, 1.5, 0, 1],
  [1, 1.5, 2, 1, 1],
  [0, 0, 0, 2, 0],
  [1, 1, 1, 0, 2],
];
const getVashyaScore = (groomRashi, brideRashi) =>
  VASHYA_MATRIX[VASHYA_GROUP[brideRashi]][VASHYA_GROUP[groomRashi]];

// ─── Guna 3: Tara (3 points) ─────────────────────────────────────────────────
// Count from the bride's star to the groom's and back, each count taken
// mod 9. A remainder of 3, 5 or 7 (Vipat, Pratyak, Vadha) is inauspicious.
// Both directions good = 3, one = 1.5, neither = 0.
const BAD_TARA = new Set([3, 5, 7]);
const getTaraScore = (groomKey, brideKey) => {
  const g = NAKSHATRA_ORDER.indexOf(groomKey);
  const b = NAKSHATRA_ORDER.indexOf(brideKey);
  if (g < 0 || b < 0) return null;
  const brideToGroom = ((g - b + 27) % 27) + 1;
  const groomToBride = ((b - g + 27) % 27) + 1;
  const good = [brideToGroom, groomToBride].filter((c) => !BAD_TARA.has(c % 9)).length;
  return good * 1.5;
};

// ─── Guna 4: Yoni (4 points) ─────────────────────────────────────────────────
const YONI_ORDER = [
  'horse', 'elephant', 'goat', 'serpent', 'dog', 'cat', 'rat',
  'cow', 'buffalo', 'tiger', 'rabbit', 'monkey', 'mongoose', 'lion',
];
const YONI_MATRIX = [
  [4, 2, 3, 2, 2, 3, 3, 2, 0, 1, 3, 2, 2, 1],
  [2, 4, 3, 2, 2, 3, 2, 3, 3, 1, 3, 2, 2, 0],
  [3, 3, 4, 2, 2, 3, 2, 3, 3, 1, 3, 0, 2, 1],
  [2, 2, 2, 4, 2, 1, 1, 2, 2, 2, 2, 1, 0, 2],
  [2, 2, 2, 2, 4, 1, 1, 2, 2, 2, 0, 2, 2, 2],
  [3, 3, 3, 1, 1, 4, 0, 3, 3, 2, 3, 2, 2, 2],
  [3, 2, 2, 1, 1, 0, 4, 3, 3, 2, 3, 2, 1, 2],
  [2, 3, 3, 2, 2, 3, 3, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 2, 2, 3, 3, 3, 4, 1, 3, 2, 2, 1],
  [1, 1, 1, 2, 2, 2, 2, 0, 1, 4, 1, 2, 2, 3],
  [3, 3, 3, 2, 0, 3, 3, 3, 3, 1, 4, 2, 2, 1],
  [2, 2, 0, 1, 2, 2, 2, 2, 2, 2, 2, 4, 2, 2],
  [2, 2, 2, 0, 2, 2, 1, 2, 2, 2, 2, 2, 4, 2],
  [1, 0, 1, 2, 2, 2, 2, 1, 1, 3, 1, 2, 2, 4],
];
const getYoniScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  const a = YONI_ORDER.indexOf(n1.yoni);
  const b = YONI_ORDER.indexOf(n2.yoni);
  if (a < 0 || b < 0) return null;
  return YONI_MATRIX[a][b];
};

// ─── Guna 5: Graha Maitri (5 points) ─────────────────────────────────────────
// Friendship between the two moon-sign lords (Parashari natural friendship).
const RASHI_LORD = [
  'mars', 'venus', 'mercury', 'moon', 'sun', 'mercury',
  'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter',
];
const PLANET_FRIENDS = {
  sun:     { friend: ['moon', 'mars', 'jupiter'], enemy: ['venus', 'saturn'] },
  moon:    { friend: ['sun', 'mercury'], enemy: [] },
  mars:    { friend: ['sun', 'moon', 'jupiter'], enemy: ['mercury'] },
  mercury: { friend: ['sun', 'venus'], enemy: ['moon'] },
  jupiter: { friend: ['sun', 'moon', 'mars'], enemy: ['mercury', 'venus'] },
  venus:   { friend: ['mercury', 'saturn'], enemy: ['sun', 'moon'] },
  saturn:  { friend: ['mercury', 'venus'], enemy: ['sun', 'moon', 'mars'] },
};
const relationOf = (from, to) => {
  const row = PLANET_FRIENDS[from];
  if (row.friend.includes(to)) return 'F';
  if (row.enemy.includes(to)) return 'E';
  return 'N';
};
const getGrahaMaitriScore = (r1, r2) => {
  const l1 = RASHI_LORD[r1];
  const l2 = RASHI_LORD[r2];
  if (!l1 || !l2) return null;
  if (l1 === l2) return 5;
  const rel = [relationOf(l1, l2), relationOf(l2, l1)].sort().join('');
  // sorted pairs: EE, EF, EN, FF, FN, NN
  const table = { FF: 5, FN: 4, NN: 3, EF: 1, EN: 0.5, EE: 0 };
  return table[rel];
};

// ─── Guna 6: Gana (6 points) ─────────────────────────────────────────────────
// [bride row][groom column], order Deva, Manushya, Rakshasa
const GANA_ORDER = ['deva', 'manushya', 'rakshasa'];
const GANA_MATRIX = [
  [6, 5, 1],
  [6, 6, 0],
  [0, 0, 6],
];
const getGanaScore = (groom, bride) => {
  if (!groom || !bride) return null;
  const g = GANA_ORDER.indexOf(groom.gana);
  const b = GANA_ORDER.indexOf(bride.gana);
  if (g < 0 || b < 0) return null;
  return GANA_MATRIX[b][g];
};

// ─── Guna 7: Bhakoot / Rashi (7 points) ──────────────────────────────────────
// The distance between the two moon signs is counted forward from each one to
// the other (the two counts always add up to 14). The pairs 2/12, 5/9 and 6/8
// are Bhakoot dosha and score 0; every other pair, including the same sign,
// scores the full 7.
//
// One cancellation is applied because every school agrees on it: when both
// signs are ruled by the same planet (Mesha/Vrishchika, Vrishabha/Tula,
// Makara/Kumbha) the dosha does not stand. Other parihara (friendly lords,
// nakshatra-based exceptions) differ between traditions and are NOT applied.
const BHAKOOT_DOSHA_PAIRS = new Set(['2/12', '5/9', '6/8']);

const getBhakootScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  const from1 = ((n2.rashi - n1.rashi + 12) % 12) + 1; // counting r1 -> r2
  const from2 = ((n1.rashi - n2.rashi + 12) % 12) + 1; // counting r2 -> r1
  const pair = `${Math.min(from1, from2)}/${Math.max(from1, from2)}`;
  if (!BHAKOOT_DOSHA_PAIRS.has(pair)) return 7;
  return RASHI_LORD[n1.rashi] === RASHI_LORD[n2.rashi] ? 7 : 0;
};

// ─── Guna 8: Nadi (8 points) ─────────────────────────────────────────────────
// Same nadi = 0 (nadi dosha — the heaviest), different = 8
const getNadiScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  return n1.nadi === n2.nadi ? 0 : 8;
};

// ─── Full Ashtakoot Score (out of 36) ────────────────────────────────────────
// A side is either a nakshatra name or { nakshatra, rashi }. The FIRST side is
// read as the groom, the second as the bride (matters for varna, vashya, gana).
const sideOf = (input) => {
  const nakshatra = typeof input === 'object' && input !== null ? input.nakshatra : input;
  const rashi = typeof input === 'object' && input !== null ? input.rashi : null;
  const key = nakshatraKey(nakshatra);
  const star = key ? NAKSHATRA_DATA[key] : null;
  return { key, star, rashi: resolveRashi(rashi) };
};

const MAXES = { varna: 1, vashya: 2, tara: 3, yoni: 4, maitri: 5, gana: 6, bhakoot: 7, nadi: 8 };

const getAshtakootScore = (groomInput, brideInput) => {
  const g = sideOf(groomInput);
  const b = sideOf(brideInput);
  if (!g.star || !b.star) return null;

  // Moon signs: the stored rashi when BOTH sides gave one (so neither is
  // compared with a guessed sign), otherwise each star's own sign.
  const useStored = g.rashi !== null && b.rashi !== null;
  const gr = useStored ? g.rashi : g.star.rashi;
  const br = useStored ? b.rashi : b.star.rashi;

  const varna = getVarnaScore(gr, br);
  const vashya = getVashyaScore(gr, br);
  const tara = getTaraScore(g.key, b.key);
  const yoni = getYoniScore(g.star, b.star);
  const maitri = getGrahaMaitriScore(gr, br);
  const gana = getGanaScore(g.star, b.star);
  const bhakoot = getBhakootScore({ rashi: gr }, { rashi: br });
  const nadi = getNadiScore(g.star, b.star);

  const gunas = { varna, vashya, tara, yoni, maitri, gana, bhakoot, nadi };

  let totalScore = 0;
  let totalMax = 0;
  for (const [key, val] of Object.entries(gunas)) {
    if (val !== null) {
      totalScore += val;
      totalMax += MAXES[key];
    }
  }

  const percentageScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

  // Scores can end in .5 — keep the half rather than rounding it away
  const rawOut36 = totalMax > 0 ? Math.round((totalScore / totalMax) * 36 * 2) / 2 : null;
  let interpretation = 'Unknown';
  if (rawOut36 !== null) {
    if (rawOut36 >= 32) interpretation = 'Excellent';
    else if (rawOut36 >= 28) interpretation = 'Very Good';
    else if (rawOut36 >= 24) interpretation = 'Good';
    else if (rawOut36 >= 18) interpretation = 'Average';
    else interpretation = 'Poor';
  }

  return {
    totalScore,
    totalMax,
    rawOut36,
    percentageScore,
    interpretation,
    hasNadiDosha: nadi === 0,
    hasBhakootDosha: bhakoot === 0,
    hasGanaDosha: gana === 0,
    gunas: {
      varna:   { score: varna,   max: 1, name: 'Varna',        detail: 'Spiritual compatibility' },
      vashya:  { score: vashya,  max: 2, name: 'Vashya',       detail: 'Mutual attraction & control' },
      tara:    { score: tara,    max: 3, name: 'Tara',          detail: 'Birth star compatibility' },
      yoni:    { score: yoni,    max: 4, name: 'Yoni',          detail: 'Physical & biological harmony' },
      maitri:  { score: maitri,  max: 5, name: 'Graha Maitri',  detail: 'Psychological compatibility' },
      gana:    { score: gana,    max: 6, name: 'Gana',          detail: 'Temperament compatibility' },
      bhakoot: { score: bhakoot, max: 7, name: 'Bhakoot',       detail: 'Love & health compatibility' },
      nadi:    { score: nadi,    max: 8, name: 'Nadi',          detail: 'Health & progeny' },
    },
  };
};

// ─── Gender-aware match ──────────────────────────────────────────────────────
// Orders the two profiles groom/bride by gender. When the pair is not one
// man + one woman (same gender, missing gender) there is no right answer, so
// the viewer is read as the groom and the reverse reading is returned as
// `alternate` (and `directionKnown` is false) so a caller can show both.
const isMale = (g) => /^(male|m|man|groom)$/i.test(String(g || ''));
const isFemale = (g) => /^(female|f|woman|bride)$/i.test(String(g || ''));

const getKundliMatch = (viewerProfile, otherProfile) => {
  const v = { nakshatra: viewerProfile?.nakshatra, rashi: viewerProfile?.rashi };
  const o = { nakshatra: otherProfile?.nakshatra, rashi: otherProfile?.rashi };

  let groom = v;
  let bride = o;
  let directionKnown = false;
  if (isMale(viewerProfile?.gender) && isFemale(otherProfile?.gender)) {
    directionKnown = true;
  } else if (isFemale(viewerProfile?.gender) && isMale(otherProfile?.gender)) {
    groom = o;
    bride = v;
    directionKnown = true;
  }

  const primary = getAshtakootScore(groom, bride);
  if (!primary) return null;
  const reverse = directionKnown ? null : getAshtakootScore(bride, groom);
  return {
    ...primary,
    directionKnown,
    // Only worth showing when the reading actually depends on direction
    alternate: reverse && reverse.totalScore !== primary.totalScore
      ? { totalScore: reverse.totalScore, rawOut36: reverse.rawOut36, interpretation: reverse.interpretation }
      : null,
  };
};

// ─── One summary for the match endpoint and the PDF ──────────────────────────
// Never calls a pair "excellent for marriage" while a major dosha stands, and
// always says the figure is indicative.
const buildKundliSummary = ({ ashtakoot, manglikCompatible, manglikDetail, rashiScore, plain = false }) => {
  const warn = plain ? '' : '⚠️ ';
  if (!ashtakoot) {
    if (rashiScore !== null && rashiScore !== undefined) {
      return `Rashi compatibility: ${rashiScore}%. ${manglikDetail}. Indicative only.`;
    }
    return 'Insufficient horoscope data for full analysis. Please complete nakshatra and birth details.';
  }
  const score = ashtakoot.rawOut36 ?? 0;
  const parts = [`Guna Milan: ${score}/36 (${ashtakoot.interpretation}).`];
  const doshas = [];
  if (ashtakoot.hasNadiDosha) doshas.push('Nadi');
  if (ashtakoot.hasBhakootDosha) doshas.push('Bhakoot');
  if (ashtakoot.hasGanaDosha) doshas.push('Gana');
  if (doshas.length) parts.push(`${warn}${doshas.join(', ')} Dosha present.`);
  if (!manglikCompatible) parts.push(`${warn}Manglik incompatibility.`);
  if (!doshas.length && manglikCompatible && score >= 28) {
    parts.push('Strong match on the traditional Guna Milan.');
  }
  parts.push('Indicative only — please consult your family pandit.');
  return parts.join(' ');
};


// ─── Rashi fallback (when only rashi known, not nakshatra) ────────────────────
const getRashiCompatibility = (rashi1, rashi2) => {
  const r1 = resolveRashi(rashi1);
  const r2 = resolveRashi(rashi2);
  if (r1 === null || r2 === null) return null;
  const diff = Math.min(Math.abs(r1 - r2), 12 - Math.abs(r1 - r2));
  if (diff === 0) return 100;
  if (diff === 1) return 80;
  if (diff === 2) return 70;
  if (diff === 3) return 60;
  if (diff === 4) return 55;
  return 50;
};

// ─── Manglik compatibility ────────────────────────────────────────────────────
// Both members have said whether they are manglik ('not_sure' is not an answer).
const manglikKnown = (m1, m2) => Boolean(m1 && m2 && m1 !== 'not_sure' && m2 !== 'not_sure');

const isManglikCompatible = (m1, m2) => {
  if (!m1 || !m2 || m1 === 'not_sure' || m2 === 'not_sure') return true;
  if (m1 === 'non_manglik' && m2 === 'manglik') return false;
  if (m1 === 'manglik' && m2 === 'non_manglik') return false;
  return true;
};

// ─── Age calculation ──────────────────────────────────────────────────────────
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

// Education ladder position from the stored canonical level, falling back to
// classifying the typed text for objects that never went through the Profile
// hook. Null when nothing is known (or the text cannot be classified).
const educationRank = (profile) => {
  const level = profile.educationLevel || normalizeEducation(profile.education);
  return EDUCATION_RANK[level] || null;
};

// ─── Main compatibility score (0-100) ────────────────────────────────────────
const calculateCompatibility = (profile1, profile2) => {
  if (!profile1 || !profile2) return 0;

  let score = 0;
  let maxScore = 0;

  // AGE (20 pts)
  maxScore += 20;
  const age1 = calculateAge(profile1.dateOfBirth);
  const age2 = calculateAge(profile2.dateOfBirth);
  if (age1 && age2) {
    const ageDiff = Math.abs(age1 - age2);
    if (ageDiff <= 2) score += 20;
    else if (ageDiff <= 5) score += 15;
    else if (ageDiff <= 8) score += 10;
    else if (ageDiff <= 12) score += 5;
  }

  // LOCATION (15 pts)
  maxScore += 15;
  if (profile1.city && profile2.city) {
    if (profile1.city.toLowerCase() === profile2.city.toLowerCase()) score += 15;
    else if (profile1.state && profile2.state &&
      profile1.state.toLowerCase() === profile2.state.toLowerCase()) score += 8;
  }

  // HEIGHT (10 pts)
  maxScore += 10;
  if (profile1.height && profile2.height) {
    const diff = Math.abs(profile1.height - profile2.height);
    if (diff <= 5) score += 10;
    else if (diff <= 10) score += 8;
    else if (diff <= 15) score += 5;
    else if (diff <= 20) score += 3;
  }

  // RELIGION (10 pts)
  maxScore += 10;
  if (profile1.religion && profile2.religion) {
    if (profile1.religion.toLowerCase() === profile2.religion.toLowerCase()) score += 10;
  }

  // EDUCATION (15 pts) — on the canonical level (constants/vocabularies), the
  // same definition search and must-haves use, so "M.Tech" and "MBA" are
  // recognised and "Postgraduate" is not mistaken for a bachelor's.
  maxScore += 15;
  const eduRank1 = educationRank(profile1);
  const eduRank2 = educationRank(profile2);
  if (eduRank1 && eduRank2) {
    const diff = Math.abs(eduRank1 - eduRank2);
    if (diff === 0) score += 15;
    else if (diff === 1) score += 12;
    else if (diff === 2) score += 8;
    else score += 4;
  }

  // LIFESTYLE (30 pts)
  maxScore += 30;
  if (profile1.diet && profile2.diet) {
    if (profile1.diet === profile2.diet) score += 10;
    else if ((profile1.diet === 'vegetarian' && profile2.diet === 'vegan') ||
             (profile1.diet === 'vegan' && profile2.diet === 'vegetarian')) score += 7;
    else score += 3;
  }
  if (profile1.smoking && profile2.smoking) {
    if (profile1.smoking === profile2.smoking) score += 10;
    else if (profile1.smoking === 'never' || profile2.smoking === 'never') score += 3;
    else score += 6;
  }
  if (profile1.drinking && profile2.drinking) {
    if (profile1.drinking === profile2.drinking) score += 10;
    else if ((profile1.drinking === 'never' && profile2.drinking === 'occasionally') ||
             (profile1.drinking === 'occasionally' && profile2.drinking === 'never')) score += 7;
    else score += 4;
  }

  // HOROSCOPE (20 pts) — Ashtakoot preferred, rashi fallback
  maxScore += 20;
  const ashtakoot = getKundliMatch(profile1, profile2);
  if (ashtakoot && ashtakoot.percentageScore !== null) {
    score += Math.round((ashtakoot.percentageScore / 100) * 16);
    score += isManglikCompatible(profile1.manglikStatus, profile2.manglikStatus) ? 4 : 0;
  } else {
    const rashiCompat = getRashiCompatibility(profile1.rashi, profile2.rashi);
    if (rashiCompat !== null) score += Math.round((rashiCompat / 100) * 12);
    if (profile1.manglikStatus && profile2.manglikStatus) {
      score += isManglikCompatible(profile1.manglikStatus, profile2.manglikStatus) ? 8 : 0;
    }
  }

  // INTEREST TAGS (10 pts)
  maxScore += 10;
  if (profile1.interestTags?.length && profile2.interestTags?.length) {
    const t1 = new Set(profile1.interestTags.map(t => t.toLowerCase()));
    const t2 = new Set(profile2.interestTags.map(t => t.toLowerCase()));
    let common = 0;
    for (const tag of t1) { if (t2.has(tag)) common++; }
    score += Math.round(((common * 2) / (t1.size + t2.size)) * 10);
  }

  // PREFERENCE MATCHING (bonus)
  if (profile1.preferredAgeMin && profile1.preferredAgeMax && age2) {
    if (age2 >= profile1.preferredAgeMin && age2 <= profile1.preferredAgeMax) { score += 5; maxScore += 5; }
  }
  if (profile1.preferredHeightMin && profile1.preferredHeightMax && profile2.height) {
    if (profile2.height >= profile1.preferredHeightMin && profile2.height <= profile1.preferredHeightMax) { score += 5; maxScore += 5; }
  }
  if (profile1.preferredCity && profile2.city) {
    const cities = Array.isArray(profile1.preferredCity) ? profile1.preferredCity : [profile1.preferredCity];
    if (cities.some(c => c.toLowerCase() === profile2.city.toLowerCase())) { score += 3; maxScore += 3; }
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return Math.max(0, Math.min(100, pct));
};

// ─── Detailed breakdown for API response ─────────────────────────────────────
const getCompatibilityBreakdown = (profile1, profile2) => {
  if (!profile1 || !profile2) return null;

  const breakdown = {
    overall: calculateCompatibility(profile1, profile2),
    categories: {},
    ashtakoot: null,
  };

  // Age
  const age1 = calculateAge(profile1.dateOfBirth);
  const age2 = calculateAge(profile2.dateOfBirth);
  if (age1 && age2) {
    const diff = Math.abs(age1 - age2);
    breakdown.categories.age = {
      score: diff <= 2 ? 100 : diff <= 5 ? 75 : diff <= 8 ? 50 : diff <= 12 ? 25 : 0,
      detail: `${diff} year${diff !== 1 ? 's' : ''} difference`,
    };
  }

  // Location
  if (profile1.city && profile2.city) {
    const sameCity  = profile1.city.toLowerCase() === profile2.city.toLowerCase();
    const sameState = profile1.state && profile2.state &&
      profile1.state.toLowerCase() === profile2.state.toLowerCase();
    breakdown.categories.location = {
      score: sameCity ? 100 : sameState ? 50 : 0,
      detail: sameCity ? 'Same city' : sameState ? 'Same state' : 'Different locations',
    };
  }

  // Lifestyle — a habit counts only when BOTH members stated it. Comparing
  // blanks (null === null) used to score two empty profiles as a 100% lifestyle
  // match, shown as a "Lifestyle match" chip next to a 12% overall score. With
  // fewer than two habits comparable there is nothing honest to say, so the
  // category is left out.
  const habits = [
    ['diet', 'diet'],
    ['smoking', 'smoking habits'],
    ['drinking', 'drinking habits'],
  ].filter(([key]) => profile1[key] && profile2[key]);
  if (habits.length >= 2) {
    const matches = habits.filter(([key]) => profile1[key] === profile2[key]).map(([, label]) => label);
    breakdown.categories.lifestyle = {
      score: Math.round((matches.length / habits.length) * 100),
      detail: matches.length > 0 ? `Matching: ${matches.join(', ')}` : 'Different lifestyle preferences',
    };
  }

  // Horoscope — full Ashtakoot breakdown
  const ashtakoot = getKundliMatch(profile1, profile2);
  const manglikOk = isManglikCompatible(profile1.manglikStatus, profile2.manglikStatus);

  if (ashtakoot) {
    breakdown.ashtakoot = {
      ...ashtakoot,
      manglikCompatible: manglikOk,
      manglikDetail: (() => {
        if (!manglikKnown(profile1.manglikStatus, profile2.manglikStatus)) return 'Manglik status unknown';
        if (!manglikOk) return 'Manglik dosha — consult pandit';
        if (profile1.manglikStatus === 'anshik_manglik' || profile2.manglikStatus === 'anshik_manglik') return 'Anshik Manglik — minor consideration';
        return 'No Manglik dosha';
      })(),
    };
    breakdown.categories.horoscope = {
      score: Math.round(((ashtakoot.percentageScore ?? 0) * 0.7) + (manglikOk ? 30 : 0)),
      detail: `Ashtakoot: ${ashtakoot.rawOut36 ?? '?'}/36 (${ashtakoot.interpretation}) · Manglik: ${manglikOk ? 'Compatible' : 'Dosha'}`,
    };
  } else {
    // Rashi fallback
    const rashiCompat = getRashiCompatibility(profile1.rashi, profile2.rashi);
    if (rashiCompat !== null || profile1.manglikStatus) {
      breakdown.categories.horoscope = {
        score: rashiCompat !== null
          ? Math.round(rashiCompat * 0.6 + (manglikOk ? 40 : 0))
          : (manglikOk ? 100 : 0),
        detail: [
          rashiCompat !== null ? `Rashi: ${rashiCompat}% compatible` : null,
          profile1.manglikStatus ? `Manglik: ${manglikOk ? 'Compatible' : 'Incompatible'}` : null,
        ].filter(Boolean).join(' · '),
      };
    }
  }

  // Community
  if (profile1.religion && profile2.religion) {
    const sameReligion = profile1.religion.toLowerCase() === profile2.religion.toLowerCase();
    const sameCaste = profile1.caste && profile2.caste &&
      profile1.caste.toLowerCase() === profile2.caste.toLowerCase();
    breakdown.categories.community = {
      score: sameReligion ? (sameCaste ? 100 : 70) : 30,
      detail: sameReligion
        ? (sameCaste ? 'Same religion & caste' : 'Same religion, different caste')
        : 'Different religion',
    };
  }

  return breakdown;
};

/**
 * D4 — "why this match" chips derived from a breakdown. Priority-ordered,
 * a category earns a chip only at score ≥ 70, capped at 3. Pure + throw-safe:
 * bad profile data yields [] and the card simply renders without chips.
 */
const REASON_PRIORITY = ['location', 'horoscope', 'community', 'lifestyle', 'age'];

const deriveReasons = (breakdown) => {
  try {
    if (!breakdown || !breakdown.categories) return [];
    const reasons = [];
    for (const key of REASON_PRIORITY) {
      const cat = breakdown.categories[key];
      if (!cat || typeof cat.score !== 'number' || cat.score < 70) continue;
      let label = null;
      if (key === 'location') {
        label = cat.detail === 'Same city' ? 'Same city' : 'Same state';
      } else if (key === 'horoscope') {
        const m = /Ashtakoot: (\d+)\/36/.exec(cat.detail || '');
        label = m ? `Kundli ${m[1]}/36` : 'Horoscope match';
      } else if (key === 'community') {
        label = cat.detail === 'Same religion & caste' ? 'Same community' : 'Same religion';
      } else if (key === 'lifestyle') {
        label = 'Lifestyle match';
      } else if (key === 'age') {
        label = 'Similar age';
      }
      if (label) reasons.push(label);
      if (reasons.length === 3) break;
    }
    return reasons;
  } catch {
    return [];
  }
};

module.exports = {
  calculateCompatibility,
  getCompatibilityBreakdown,
  deriveReasons,
  getAshtakootScore,
  getKundliMatch,
  buildKundliSummary,
  resolveRashi,
  getBhakootScore,
  calculateAge,
  isManglikCompatible,
  manglikKnown,
  getRashiCompatibility,
};
