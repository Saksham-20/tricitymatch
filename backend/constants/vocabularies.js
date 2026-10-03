'use strict';

/**
 * Controlled vocabularies for education, profession and caste (audit P2).
 *
 * These were free text, and the data shows what that costs: education holds
 * "Masters", "Master", "M.Tech", "MBA" and "Ph.D" / "PhD" side by side, and
 * search matched `education` by exact string, so filtering for "Master" missed
 * every "Masters" and "M.Tech". The web and the app also offer different
 * profession lists, so a filter chosen on one platform found nothing entered on
 * the other.
 *
 * The typed text stays as the member wrote it (it is what other members read).
 * Two derived columns, `educationLevel` and `professionGroup`, hold the
 * canonical value, set by a Profile hook on every write and used by search.
 * Caste is rewritten to its canonical spelling only on an exact/alias match;
 * anything else is kept as typed, since we never want to force a member into a
 * community list.
 */

// ── Education ────────────────────────────────────────────────────────────────

const EDUCATION_LEVELS = ['school', 'diploma', 'bachelor', 'master', 'doctorate', 'professional'];

const EDUCATION_LEVEL_LABELS = {
  school: '12th pass or below',
  diploma: 'Diploma',
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  doctorate: 'Doctorate (PhD)',
  professional: 'Professional degree (MBBS, CA, LLB ...)',
};

// Checked in this order; the first level with a matching token wins.
const EDUCATION_TOKENS = [
  ['doctorate', ['phd', 'doctorate', 'dphil', 'dsc']],
  ['professional', ['mbbs', 'bds', 'bams', 'bhms', 'bpt', 'icwa', 'cma', 'llb', 'llm', 'professional']],
  ['master', ['master', 'masters', 'mtech', 'msc', 'mcom', 'ma', 'med', 'mphil', 'mba', 'pgdm', 'mca', 'march', 'mpharm', 'mpharma', 'postgraduate', 'pg']],
  ['bachelor', ['bachelor', 'bachelors', 'btech', 'be', 'bsc', 'bcom', 'ba', 'bba', 'bca', 'bed', 'barch', 'bpharm', 'bpharma', 'graduate', 'graduation', 'ug']],
  ['diploma', ['diploma', 'polytechnic', 'iti', 'dpharm', 'dpharma']],
  ['school', ['12th', '10th', 'hsc', 'ssc', 'intermediate', 'matric', 'matriculation', 'highschool', 'school']],
];

// Two-letter abbreviations that collide with branch names and common words:
// 'ME' is Mechanical Engineering as often as Master of Engineering, 'CS' is
// Computer Science, 'MS' is "MS Office". They only decide the level when they
// are the whole answer ("CA", "MD"); beside a degree ("B.Tech CS") the degree
// decides. (PROF-08)
const AMBIGUOUS_EDUCATION = [
  ['professional', 'ca'], ['professional', 'cs'], ['professional', 'md'],
  ['master', 'me'], ['master', 'ms'],
];

const tokens = (text) => String(text || '')
  .toLowerCase()
  .replace(/\.(?=[a-z])/g, '')       // B.Tech -> BTech, Ph.D -> PhD, M.A -> MA
  .split(/[^a-z0-9]+/)
  .filter(Boolean);

const normalizeEducation = (text) => {
  if (!text || !String(text).trim()) return null;
  const raw = String(text).toLowerCase();
  if (/post\s*-?\s*graduate/.test(raw)) return 'master';
  if (/high\s*school/.test(raw)) return 'school';
  const set = new Set(tokens(text));
  for (const [level, words] of EDUCATION_TOKENS) {
    if (words.some((w) => set.has(w))) return level;
  }
  if (set.size === 1) {
    const [only] = [...set];
    const hit = AMBIGUOUS_EDUCATION.find(([, w]) => w === only);
    if (hit) return hit[0];
  }
  return null;
};

// ── Profession ───────────────────────────────────────────────────────────────

const PROFESSION_GROUPS = [
  'Student',
  'Software / IT',
  'Doctor / Healthcare',
  'Lawyer / Legal',
  'Armed Forces / Police',
  'Government / Civil Services',
  'Teacher / Academia',
  'CA / Finance',
  'Architecture / Design / Media',
  'Engineer',
  'Business / Management',
  'Other',
];

// [group, substrings, whole-word tokens]. Order is priority: "Engineer
// (Software)" must land in Software / IT before the generic Engineer rule.
const PROFESSION_RULES = [
  ['Student', ['student'], []],
  ['Software / IT', ['software', 'developer', 'programmer', 'data scien', 'devops', 'it professional', 'information technology'], ['it', 'sde', 'swe']],
  // Sales and marketing roles in a medical or software field are business, not clinical.
  ['Business / Management', ['representative', 'sales', 'marketing'], []],
  ['Doctor / Healthcare', ['doctor', 'physician', 'dentist', 'surgeon', 'nurse', 'paramedic', 'pharmacist', 'medical', 'healthcare'], ['dr', 'md', 'mbbs']],
  ['Lawyer / Legal', ['lawyer', 'advocate', 'attorney', 'judge', 'legal'], []],
  ['Armed Forces / Police', ['army', 'navy', 'air force', 'armed', 'police', 'defence', 'defense', 'soldier'], ['ips', 'crpf', 'bsf']],
  ['Government / Civil Services', ['government', 'civil serv', 'govt', 'psu', 'public sector'], ['ias', 'ifs', 'irs', 'pcs']],
  ['Teacher / Academia', ['teacher', 'professor', 'lecturer', 'faculty', 'tutor', 'academic', 'researcher', 'scientist'], []],
  ['CA / Finance', ['accountant', 'banker', 'banking', 'finance', 'chartered', 'auditor', 'investment'], ['ca', 'cfa', 'bank']],
  ['Architecture / Design / Media', ['architect', 'designer', 'artist', 'journalist', 'media', 'photograph', 'writer', 'creative', 'chef', 'hospitality', 'pilot', 'aviation'], []],
  ['Engineer', ['engineer'], []],
  ['Business / Management', ['business', 'entrepreneur', 'self employed', 'self-employed', 'founder', 'manager', 'consultant', 'analyst', 'director', 'owner', 'executive'], ['ceo']],
];

const normalizeProfession = (text) => {
  if (!text || !String(text).trim()) return null;
  const raw = String(text).toLowerCase();
  const set = new Set(tokens(text));
  for (const [group, needles, words] of PROFESSION_RULES) {
    if (needles.some((n) => raw.includes(n)) || words.some((w) => set.has(w))) return group;
  }
  return 'Other';
};

/** A filter value may already be a group label; accept it as such. */
const professionGroupFromFilter = (value) => {
  const exact = PROFESSION_GROUPS.find((g) => g.toLowerCase() === String(value || '').trim().toLowerCase());
  return exact || normalizeProfession(value);
};

// ── Caste ────────────────────────────────────────────────────────────────────

// Same spellings the signup and profile editor offer (frontend CASTE_OPTIONS).
const CASTES = [
  'Ad Dharmi', 'Aggarwal', 'Ahluwalia', 'Arora', 'Bagga', 'Bania', 'Bhardwaj',
  'Bhatia', 'Bhati', 'Brahmin', 'Chadha', 'Chhabra', 'Chimba', 'Dhiman',
  'Gill', 'Grewal', 'Gujjar', 'Jain', 'Jaiswal', 'Jatt', 'Julaha', 'Kalsi',
  'Kamboj', 'Kashyap', 'Kayastha', 'Khatri', 'Kshatriya', 'Kumhar', 'Labana',
  'Lohar', 'Mahajan', 'Mair Rajput', 'Maurya', 'Mehra', 'Nai', 'Prajapati',
  'Rajput', 'Ramdasia', 'Ramgarhia', 'Rathore', 'Ravidasia', 'Saini', 'Sander',
  'Sethi', 'Sharma', 'Sikligar', 'Sindhi', 'Sood', 'Sunar', 'Tank Kshatriya',
  'Tarkhan', 'Teli', 'Thakur', 'Tomar', 'Verma', 'Yadav',
];

// Alternate spellings people actually type.
const CASTE_ALIASES = {
  jat: 'Jatt', jatt: 'Jatt', 'jat sikh': 'Jatt', 'jatt sikh': 'Jatt',
  agarwal: 'Aggarwal', aggrawal: 'Aggarwal', agrawal: 'Aggarwal', aggarwal: 'Aggarwal',
  brahman: 'Brahmin', bramhin: 'Brahmin', brahmin: 'Brahmin', bhramin: 'Brahmin',
  ramgharia: 'Ramgarhia', ramgarhiya: 'Ramgarhia',
  rajpoot: 'Rajput', rajpout: 'Rajput',
  khatri: 'Khatri', kshatri: 'Khatri',
  kayasth: 'Kayastha', kayastha: 'Kayastha',
  ravidasi: 'Ravidasia', ravidassia: 'Ravidasia',
  ramdasi: 'Ramdasia', ramdassia: 'Ramdasia',
  addharmi: 'Ad Dharmi', 'ad-dharmi': 'Ad Dharmi',
  tarkhan: 'Tarkhan', tarkhaan: 'Tarkhan', 'tarkhan (carpenter)': 'Tarkhan',
  labana: 'Labana', lubana: 'Labana',
  kamboh: 'Kamboj', kamboj: 'Kamboj',
  chimba: 'Chimba', chhimba: 'Chimba',
  saini: 'Saini', sainee: 'Saini',
};

const CASTE_BY_KEY = new Map(CASTES.map((c) => [c.toLowerCase(), c]));

const casteKey = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Canonical spelling on an exact or alias match, otherwise the trimmed input. */
const normalizeCaste = (text) => {
  if (text === null || text === undefined) return text;
  const key = casteKey(text);
  if (!key) return '';
  return CASTE_BY_KEY.get(key) || CASTE_ALIASES[key] || String(text).replace(/\s+/g, ' ').trim();
};

/**
 * Every lower-case spelling a caste filter should match: the canonical name plus
 * each alias that maps to it. Legacy rows written before spellings were
 * canonicalised ('Jat', 'Jat Sikh') are found by a search for 'Jatt' and the
 * other way round. Text that is not a known caste matches only itself.
 */
const casteFilterKeys = (text) => {
  const canonical = normalizeCaste(text);
  const key = casteKey(canonical);
  if (!key) return [];
  const keys = new Set([key, casteKey(text)]);
  for (const [alias, target] of Object.entries(CASTE_ALIASES)) {
    if (casteKey(target) === key) keys.add(alias);
  }
  return [...keys];
};

module.exports = {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  PROFESSION_GROUPS,
  CASTES,
  normalizeEducation,
  normalizeProfession,
  professionGroupFromFilter,
  normalizeCaste,
  casteFilterKeys,
};
