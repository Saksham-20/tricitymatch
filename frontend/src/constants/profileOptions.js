// Single source of truth for profile dropdown options AND their display labels.
// Used by the onboarding/editor inputs AND every profile display surface so an
// ENUM like `non_manglik` never renders raw to a user again.

// ─── Manglik / dosha ─────────────────────────────────────────────────────────
export const MANGLIK_OPTIONS = [
  { value: 'manglik', label: 'Manglik' },
  { value: 'non_manglik', label: 'Non-Manglik' },
  { value: 'anshik_manglik', label: 'Anshik (partial) Manglik' },
  { value: 'not_sure', label: "Don't know" },
];

// ─── Marital status ──────────────────────────────────────────────────────────
export const MARITAL_OPTIONS = [
  { value: 'never_married', label: 'Never Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'awaiting_divorce', label: 'Awaiting Divorce' },
];

// ─── Family ──────────────────────────────────────────────────────────────────
export const FAMILY_TYPE_OPTIONS = [
  { value: 'joint', label: 'Joint Family' },
  { value: 'nuclear', label: 'Nuclear Family' },
];

export const FAMILY_STATUS_OPTIONS = [
  { value: 'middle_class', label: 'Middle Class' },
  { value: 'upper_middle_class', label: 'Upper Middle Class' },
  { value: 'affluent', label: 'Affluent' },
  { value: 'rich', label: 'Rich' },
];

// ─── Horoscope ───────────────────────────────────────────────────────────────
// Western sun-sign (distinct from Vedic Rashi / moon-sign).
export const ZODIAC_OPTIONS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
].map((z) => ({ value: z, label: z }));

// Vedic moon-sign (12).
export const RASHI_OPTIONS = [
  ['Mesha', 'Mesha (Aries)'], ['Vrishabha', 'Vrishabha (Taurus)'],
  ['Mithuna', 'Mithuna (Gemini)'], ['Karka', 'Karka (Cancer)'],
  ['Simha', 'Simha (Leo)'], ['Kanya', 'Kanya (Virgo)'],
  ['Tula', 'Tula (Libra)'], ['Vrishchika', 'Vrishchika (Scorpio)'],
  ['Dhanu', 'Dhanu (Sagittarius)'], ['Makara', 'Makara (Capricorn)'],
  ['Kumbha', 'Kumbha (Aquarius)'], ['Meena', 'Meena (Pisces)'],
].map(([value, label]) => ({ value, label }));

// 27 Nakshatras (Vedic lunar mansions).
export const NAKSHATRA_OPTIONS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
].map((n) => ({ value: n, label: n }));

// ─── Caste / community ───────────────────────────────────────────────────────
// Alphabetical, NOT ranked — plus a free-text "Other" so we never author a
// caste taxonomy or imply hierarchy. Always optional. Covers common Tricity /
// North-India communities across Hindu/Sikh/etc.; "Other" catches the rest.
export const CASTE_OPTIONS = [
  'Aggarwal', 'Arora', 'Bania', 'Bhatia', 'Brahmin', 'Chadha', 'Chhabra',
  'Gujjar', 'Jatt', 'Kamboj', 'Kayastha', 'Khatri', 'Kshatriya', 'Kumhar',
  'Labana', 'Lohar', 'Mahajan', 'Nai', 'Rajput', 'Ramdasia', 'Ramgarhia',
  'Ravidasia', 'Saini', 'Sood', 'Tank Kshatriya', 'Thakur', 'Yadav',
].map((c) => ({ value: c, label: c }));

export const CASTE_OTHER = '__other__';

// ─── Label lookup ────────────────────────────────────────────────────────────
const toMap = (opts) => Object.fromEntries(opts.map((o) => [o.value, o.label]));

const LABEL_MAPS = {
  manglikStatus: toMap(MANGLIK_OPTIONS),
  maritalStatus: toMap(MARITAL_OPTIONS),
  familyType: toMap(FAMILY_TYPE_OPTIONS),
  familyStatus: toMap(FAMILY_STATUS_OPTIONS),
};

// Fallback: title-case a raw snake_case value ("non_manglik" → "Non Manglik").
export const formatEnum = (value) => {
  if (value == null || value === '') return '';
  return String(value)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// friendlyLabel('manglikStatus', 'non_manglik') → 'Non-Manglik'
export const friendlyLabel = (field, value) => {
  if (value == null || value === '') return '';
  const map = LABEL_MAPS[field];
  return (map && map[value]) || formatEnum(value);
};
