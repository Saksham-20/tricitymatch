/**
 * Compatibility Calculator — Vedic Ashtakoot Guna Milan + lifestyle scoring
 */

// ─── Vedic Ashtakoot System ──────────────────────────────────────────────────
// 27 Nakshatras mapped to their Varna, Vashya, Tara, Yoni, Graha Maitri, Gana,
// Bhakoot (Rashi), and Nadi values for all 8 Gunas.

const NAKSHATRA_DATA = {
  ashwini:      { varna: 4, vashya: 2, yoni: 'horse', gana: 'deva',  nadi: 'anta',  rashi: 0  },
  bharani:      { varna: 1, vashya: 2, yoni: 'elephant', gana: 'manushya', nadi: 'madhya', rashi: 0 },
  krittika:     { varna: 2, vashya: 2, yoni: 'goat', gana: 'rakshasa', nadi: 'aadi', rashi: 0 },
  rohini:       { varna: 4, vashya: 4, yoni: 'serpent', gana: 'manushya', nadi: 'anta', rashi: 1 },
  mrigashira:   { varna: 4, vashya: 4, yoni: 'serpent', gana: 'deva', nadi: 'madhya', rashi: 1 },
  ardra:        { varna: 1, vashya: 3, yoni: 'dog', gana: 'manushya', nadi: 'aadi', rashi: 2 },
  punarvasu:    { varna: 4, vashya: 3, yoni: 'cat', gana: 'deva', nadi: 'anta', rashi: 2 },
  pushya:       { varna: 2, vashya: 3, yoni: 'goat', gana: 'deva', nadi: 'madhya', rashi: 3 },
  ashlesha:     { varna: 1, vashya: 3, yoni: 'cat', gana: 'rakshasa', nadi: 'aadi', rashi: 3 },
  magha:        { varna: 1, vashya: 4, yoni: 'rat', gana: 'rakshasa', nadi: 'anta', rashi: 4 },
  purva_phalguni: { varna: 4, vashya: 4, yoni: 'rat', gana: 'manushya', nadi: 'madhya', rashi: 4 },
  uttara_phalguni: { varna: 2, vashya: 4, yoni: 'cow', gana: 'manushya', nadi: 'aadi', rashi: 4 },
  hasta:        { varna: 4, vashya: 4, yoni: 'buffalo', gana: 'deva', nadi: 'anta', rashi: 5 },
  chitra:       { varna: 3, vashya: 4, yoni: 'tiger', gana: 'rakshasa', nadi: 'madhya', rashi: 5 },
  swati:        { varna: 4, vashya: 3, yoni: 'buffalo', gana: 'deva', nadi: 'aadi', rashi: 6 },
  vishakha:     { varna: 2, vashya: 3, yoni: 'tiger', gana: 'rakshasa', nadi: 'anta', rashi: 6 },
  anuradha:     { varna: 4, vashya: 3, yoni: 'rabbit', gana: 'deva', nadi: 'madhya', rashi: 7 },
  jyeshtha:     { varna: 2, vashya: 3, yoni: 'rabbit', gana: 'rakshasa', nadi: 'aadi', rashi: 7 },
  moola:        { varna: 1, vashya: 3, yoni: 'dog', gana: 'rakshasa', nadi: 'anta', rashi: 8 },
  purva_ashadha: { varna: 4, vashya: 3, yoni: 'monkey', gana: 'manushya', nadi: 'madhya', rashi: 8 },
  uttara_ashadha: { varna: 2, vashya: 3, yoni: 'mongoose', gana: 'manushya', nadi: 'aadi', rashi: 8 },
  shravana:     { varna: 4, vashya: 4, yoni: 'monkey', gana: 'deva', nadi: 'anta', rashi: 9 },
  dhanistha:    { varna: 3, vashya: 4, yoni: 'lion', gana: 'rakshasa', nadi: 'madhya', rashi: 9 },
  shatabhisha:  { varna: 1, vashya: 1, yoni: 'horse', gana: 'rakshasa', nadi: 'aadi', rashi: 10 },
  purva_bhadrapada: { varna: 2, vashya: 1, yoni: 'lion', gana: 'manushya', nadi: 'anta', rashi: 10 },
  uttara_bhadrapada: { varna: 2, vashya: 1, yoni: 'cow', gana: 'deva', nadi: 'madhya', rashi: 11 },
  revati:       { varna: 4, vashya: 1, yoni: 'elephant', gana: 'deva', nadi: 'aadi', rashi: 11 },
};

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
  'dhanistha': 'dhanistha', 'dhanishtha': 'dhanistha', 'dhanista': 'dhanistha',
  'shatabhisha': 'shatabhisha', 'shatabhisha': 'shatabhisha', 'sadayam': 'shatabhisha',
  'purva_bhadrapada': 'purva_bhadrapada', 'purva bhadrapada': 'purva_bhadrapada',
  'uttara_bhadrapada': 'uttara_bhadrapada', 'uttara bhadrapada': 'uttara_bhadrapada',
  'revati': 'revati',
};

const resolveNakshatra = (name) => {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  const canonical = NAKSHATRA_ALIASES[key] || key;
  return NAKSHATRA_DATA[canonical] || null;
};

// ─── Guna 1: Varna (1 point max) ─────────────────────────────────────────────
// Brahmin(4) > Kshatriya(3) > Vaishya(2) > Shudra(1)
// Groom varna >= Bride varna → full point
const getVarnaScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  // Traditional: groom (n1) varna >= bride (n2) varna
  return n1.varna >= n2.varna ? 1 : 0;
};

// ─── Guna 2: Vashya (2 points max) ───────────────────────────────────────────
// Compatibility categories: manav(1), vanchar(2), chatushpad(3), jalchar(4), keet(5)
// Simplified: matching vashya = 2, complementary = 1, else 0
const getVashyaScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  if (n1.vashya === n2.vashya) return 2;
  // Complementary pairs (simplified)
  const complementary = new Set([`${n1.vashya}_${n2.vashya}`, `${n2.vashya}_${n1.vashya}`]);
  if (complementary.has('1_2') || complementary.has('3_4')) return 1;
  return 0;
};

// ─── Guna 3: Tara (3 points max) ─────────────────────────────────────────────
// Birth star counted from bride's to groom's. Count / 9 remainder must be 1,3,5,7.
const NAKSHATRA_ORDER = Object.keys(NAKSHATRA_DATA);

const getTaraScore = (n1Key, n2Key) => {
  const i1 = NAKSHATRA_ORDER.indexOf(n1Key);
  const i2 = NAKSHATRA_ORDER.indexOf(n2Key);
  if (i1 < 0 || i2 < 0) return null;
  // Count from n2 to n1
  const diff = ((i1 - i2 + 27) % 27) + 1;
  const remainder = diff % 9;
  const auspicious = new Set([1, 3, 5, 7]);
  return auspicious.has(remainder) ? 3 : 0;
};

// ─── Guna 4: Yoni (4 points max) ─────────────────────────────────────────────
// Same yoni = 4, friendly = 3, neutral = 2, enemy = 1, hostile = 0
const YONI_ENEMIES = {
  horse: 'buffalo', buffalo: 'horse',
  elephant: 'lion', lion: 'elephant',
  goat: 'monkey', monkey: 'goat',
  rat: 'cat', cat: 'rat',
  cow: 'tiger', tiger: 'cow',
  dog: 'rabbit', rabbit: 'dog',
  serpent: 'mongoose', mongoose: 'serpent',
};

const getYoniScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  if (n1.yoni === n2.yoni) return 4;
  if (YONI_ENEMIES[n1.yoni] === n2.yoni) return 0;
  return 2; // neutral
};

// ─── Guna 5: Graha Maitri (5 points max) ─────────────────────────────────────
// Based on rashi lords. Simplified: same rashi = 5, adjacent = 4, else 2-3
const getRashiLord = (rashiIdx) => {
  // Rashi lords: Mesh=Mars,Vrishabh=Venus,Mithun=Mercury,Kark=Moon,Simha=Sun,
  //   Kanya=Mercury,Tula=Venus,Vrishchik=Mars,Dhanu=Jupiter,Makar=Saturn,Kumbh=Saturn,Meen=Jupiter
  const lords = ['mars','venus','mercury','moon','sun','mercury','venus','mars','jupiter','saturn','saturn','jupiter'];
  return lords[rashiIdx] || null;
};

const PLANET_FRIENDS = {
  sun:     ['moon','mars','jupiter'],
  moon:    ['sun','mercury'],
  mars:    ['sun','moon','jupiter'],
  mercury: ['sun','venus'],
  jupiter: ['sun','moon','mars'],
  venus:   ['mercury','saturn'],
  saturn:  ['mercury','venus'],
};

const getPlanetRelation = (p1, p2) => {
  if (p1 === p2) return 'same';
  if (PLANET_FRIENDS[p1]?.includes(p2)) return 'friend';
  return 'neutral';
};

const getGrahaMaitriScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  const l1 = getRashiLord(n1.rashi);
  const l2 = getRashiLord(n2.rashi);
  if (!l1 || !l2) return null;
  const rel = getPlanetRelation(l1, l2);
  if (rel === 'same') return 5;
  if (rel === 'friend') return 4;
  const rel2 = getPlanetRelation(l2, l1);
  if (rel2 === 'friend') return 3;
  return 2;
};

// ─── Guna 6: Gana (6 points max) ─────────────────────────────────────────────
// Deva+Deva=6, Manushya+Manushya=6, Rakshasa+Rakshasa=6
// Deva+Manushya=5, Manushya+Deva=5, Rakshasa+Manushya=1, Manushya+Rakshasa=0
// Deva+Rakshasa=0, Rakshasa+Deva=0
const GANA_SCORE = {
  deva_deva: 6, manushya_manushya: 6, rakshasa_rakshasa: 6,
  deva_manushya: 5, manushya_deva: 5,
  deva_rakshasa: 0, rakshasa_deva: 0,
  manushya_rakshasa: 0, rakshasa_manushya: 1,
};

const getGanaScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  const key = `${n1.gana}_${n2.gana}`;
  return GANA_SCORE[key] ?? null;
};

// ─── Guna 7: Bhakoot / Rashi (7 points max) ──────────────────────────────────
// Certain rashi pair differences are inauspicious: 2/12, 6/8, 5/9
const getBhakootScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  const r1 = n1.rashi + 1; // 1-indexed
  const r2 = n2.rashi + 1;
  const diff = Math.abs(r1 - r2);
  const largeDiff = 12 - diff;
  const pair = [Math.min(diff, largeDiff), Math.max(diff, largeDiff)];
  const inauspicious = [[1,11],[2,10],[3,9],[4,8],[5,7],[6,6]];
  // Specifically bad: 6/8 and 2/12 (represented as diff=6 or diff=2 with complement=10)
  if ((diff === 6) || (diff === 2 && largeDiff === 10) || (diff === 5 && largeDiff === 7)) {
    return 0;
  }
  if (r1 === r2) return 7; // same rashi
  return 7; // all other combinations = full marks (simplified — full Bhakoot requires more detail)
};

// ─── Guna 8: Nadi (8 points max) ─────────────────────────────────────────────
// Same nadi = 0 (nadi dosha — most critical), different = 8
const getNadiScore = (n1, n2) => {
  if (!n1 || !n2) return null;
  return n1.nadi === n2.nadi ? 0 : 8;
};

// ─── Full Ashtakoot Score (out of 36) ────────────────────────────────────────
const getAshtakootScore = (nakshatra1Name, nakshatra2Name) => {
  const n1 = resolveNakshatra(nakshatra1Name);
  const n2 = resolveNakshatra(nakshatra2Name);

  if (!n1 || !n2) return null;

  const n1Key = NAKSHATRA_ALIASES[nakshatra1Name?.toLowerCase().trim()] || nakshatra1Name?.toLowerCase().trim();
  const n2Key = NAKSHATRA_ALIASES[nakshatra2Name?.toLowerCase().trim()] || nakshatra2Name?.toLowerCase().trim();

  const varna  = getVarnaScore(n1, n2);
  const vashya = getVashyaScore(n1, n2);
  const tara   = getTaraScore(n1Key, n2Key);
  const yoni   = getYoniScore(n1, n2);
  const maitri = getGrahaMaitriScore(n1, n2);
  const gana   = getGanaScore(n1, n2);
  const bhakoot = getBhakootScore(n1, n2);
  const nadi   = getNadiScore(n1, n2);

  const gunas = { varna, vashya, tara, yoni, maitri, gana, bhakoot, nadi };
  const maxes = { varna: 1, vashya: 2, tara: 3, yoni: 4, maitri: 5, gana: 6, bhakoot: 7, nadi: 8 };

  let totalScore = 0;
  let totalMax = 0;

  for (const [key, val] of Object.entries(gunas)) {
    if (val !== null) {
      totalScore += val;
      totalMax += maxes[key];
    }
  }

  const percentageScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

  // Traditional interpretation thresholds
  const rawOut36 = totalMax > 0 ? Math.round((totalScore / totalMax) * 36) : null;
  let interpretation = 'Unknown';
  if (rawOut36 !== null) {
    if (rawOut36 >= 32) interpretation = 'Excellent';
    else if (rawOut36 >= 28) interpretation = 'Very Good';
    else if (rawOut36 >= 24) interpretation = 'Good';
    else if (rawOut36 >= 18) interpretation = 'Average';
    else interpretation = 'Poor';
  }

  // Check critical doshas
  const hasNadiDosha = nadi === 0;
  const hasBhakootDosha = bhakoot === 0;
  const hasGanaDosha = gana === 0;

  return {
    totalScore,
    totalMax,
    rawOut36,
    percentageScore,
    interpretation,
    hasNadiDosha,
    hasBhakootDosha,
    hasGanaDosha,
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

// ─── Rashi fallback (when only rashi known, not nakshatra) ────────────────────
const RASHI_MAP = {
  mesh: 0, aries: 0,
  vrishabh: 1, taurus: 1,
  mithun: 2, gemini: 2,
  kark: 3, cancer: 3,
  simha: 4, leo: 4,
  kanya: 5, virgo: 5,
  tula: 6, libra: 6,
  vrishchik: 7, scorpio: 7,
  dhanu: 8, sagittarius: 8,
  makar: 9, capricorn: 9,
  kumbh: 10, aquarius: 10,
  meen: 11, pisces: 11,
};

const getRashiCompatibility = (rashi1, rashi2) => {
  const r1 = RASHI_MAP[rashi1?.toLowerCase()];
  const r2 = RASHI_MAP[rashi2?.toLowerCase()];
  if (r1 === undefined || r2 === undefined) return null;
  const diff = Math.min(Math.abs(r1 - r2), 12 - Math.abs(r1 - r2));
  if (diff === 0) return 100;
  if (diff === 1) return 80;
  if (diff === 2) return 70;
  if (diff === 3) return 60;
  if (diff === 4) return 55;
  return 50;
};

// ─── Manglik compatibility ────────────────────────────────────────────────────
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

  // EDUCATION (15 pts)
  maxScore += 15;
  if (profile1.education && profile2.education) {
    const levels = { 'high school': 1, 'diploma': 2, 'bachelor': 3, 'graduate': 3, 'master': 4, 'postgraduate': 4, 'doctorate': 5, 'phd': 5 };
    const getLevel = (edu) => {
      const e = edu.toLowerCase();
      for (const [k, v] of Object.entries(levels)) { if (e.includes(k)) return v; }
      return 2;
    };
    const diff = Math.abs(getLevel(profile1.education) - getLevel(profile2.education));
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
  const ashtakoot = getAshtakootScore(profile1.nakshatra, profile2.nakshatra);
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

  // Lifestyle
  const matches = [];
  if (profile1.diet === profile2.diet) matches.push('diet');
  if (profile1.smoking === profile2.smoking) matches.push('smoking habits');
  if (profile1.drinking === profile2.drinking) matches.push('drinking habits');
  breakdown.categories.lifestyle = {
    score: Math.round((matches.length / 3) * 100),
    detail: matches.length > 0 ? `Matching: ${matches.join(', ')}` : 'Different lifestyle preferences',
  };

  // Horoscope — full Ashtakoot breakdown
  const ashtakoot = getAshtakootScore(profile1.nakshatra, profile2.nakshatra);
  const manglikOk = isManglikCompatible(profile1.manglikStatus, profile2.manglikStatus);

  if (ashtakoot) {
    breakdown.ashtakoot = {
      ...ashtakoot,
      manglikCompatible: manglikOk,
      manglikDetail: (() => {
        if (!profile1.manglikStatus || !profile2.manglikStatus) return 'Manglik status unknown';
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

module.exports = {
  calculateCompatibility,
  getCompatibilityBreakdown,
  getAshtakootScore,
  calculateAge,
  isManglikCompatible,
  getRashiCompatibility,
};
