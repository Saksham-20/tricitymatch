/**
 * Compatibility score: education on the canonical level (DISC-10), and a
 * lifestyle category that only counts habits both members stated (DISC-12).
 * Saved-search filter whitelist (DISC-18).
 */
const { calculateCompatibility, getCompatibilityBreakdown, deriveReasons } = require('../../utils/compatibility');
const { sanitizeSavedFilters, sanitizeSavedSearchList } = require('../../utils/savedSearches');
const { casteFilterKeys } = require('../../constants/vocabularies');

// Everything but education equal and known, so the education points are the only difference.
const base = { dateOfBirth: '1995-06-01', city: 'Mohali', height: 170, religion: 'Hindu' };
const score = (e1, e2) => calculateCompatibility({ ...base, education: e1 }, { ...base, education: e2 });

describe('compatibility: education', () => {
  it('ranks Postgraduate above a bachelor\'s (the old includes() read it as "graduate")', () => {
    expect(score('Postgraduate', 'Bachelor')).toBeLessThan(score('Postgraduate', 'Postgraduate'));
    expect(score('Postgraduate', 'Bachelor')).toBeLessThan(score('Postgraduate', 'Master'));
  });

  it('recognises abbreviations: B.Tech vs M.Tech differ, B.Tech vs B.Tech do not', () => {
    expect(score('B.Tech', 'M.Tech')).toBeLessThan(score('B.Tech', 'B.Tech'));
    expect(score('MBA', 'Masters')).toBe(score('MBA', 'MBA'));
    expect(score('Masters', 'PhD')).toBeLessThan(score('Masters', 'Masters'));
  });

  it('prefers the stored canonical level over the typed text', () => {
    const typed = calculateCompatibility({ ...base, education: 'whatever', educationLevel: 'master' }, { ...base, education: 'MBA' });
    expect(typed).toBe(score('MBA', 'MBA'));
  });

  it('adds nothing when either side is unknown or unclassifiable', () => {
    expect(score(null, 'Masters')).toBe(score('???', 'Masters'));
  });
});

describe('breakdown: lifestyle', () => {
  const life = (a, b) => getCompatibilityBreakdown({ ...base, ...a }, { ...base, ...b }).categories.lifestyle;

  it('leaves the category out when nobody stated lifestyle (null === null is not a match)', () => {
    expect(life({}, {})).toBeUndefined();
    expect(life({ diet: 'vegan' }, {})).toBeUndefined();
  });

  it('needs at least two comparable habits', () => {
    expect(life({ diet: 'vegan' }, { diet: 'vegan' })).toBeUndefined();
    expect(life({ diet: 'vegan', smoking: 'never' }, { diet: 'vegan', smoking: 'never' })).toMatchObject({ score: 100 });
  });

  it('counts only habits both members stated, out of those compared', () => {
    const c = life(
      { diet: 'vegan', smoking: 'never', drinking: 'never' },
      { diet: 'vegan', smoking: 'regularly' }, // drinking unknown on one side
    );
    expect(c.score).toBe(50);
    expect(c.detail).toBe('Matching: diet');
  });

  it('gives no "Lifestyle match" chip to two blank profiles', () => {
    const breakdown = getCompatibilityBreakdown({ ...base }, { ...base });
    expect(deriveReasons(breakdown)).not.toContain('Lifestyle match');
  });
});

describe('saved-search filters', () => {
  it('keeps the whole Search filter set and drops junk, invalid values and unknown keys', () => {
    const out = sanitizeSavedFilters({
      religion: ' Hindu ', caste: 'Jatt', education: 'Master', profession: 'Software / IT', motherTongue: 'Punjabi',
      city: 'Mohali', ageMin: '25', ageMax: 35, heightMin: 150, heightMax: 190, incomeMin: 500000,
      diet: 'vegetarian', smoking: 'never', drinking: 'occasionally', maritalStatus: 'divorced',
      manglikFilter: 'non_manglik_only', verifiedOnly: 'true', sortBy: 'age',
      bogus: 'x', __proto__: { admin: true },
    });
    expect(out).toEqual({
      religion: 'Hindu', caste: 'Jatt', education: 'Master', profession: 'Software / IT', motherTongue: 'Punjabi',
      city: ['Mohali'], ageMin: 25, ageMax: 35, heightMin: 150, heightMax: 190, incomeMin: 500000,
      diet: 'vegetarian', smoking: 'never', drinking: 'occasionally', maritalStatus: 'divorced',
      manglikFilter: 'non_manglik_only', verifiedOnly: 'true', sortBy: 'age',
    });
  });

  it('rejects values the search itself would refuse', () => {
    expect(sanitizeSavedFilters({ diet: 'eggetarian', drinking: 'socially', ageMin: 12, ageMax: 120, heightMin: 5, sortBy: 'lastLogin' })).toEqual({});
  });

  it('drops an inverted range end and caps the list', () => {
    expect(sanitizeSavedFilters({ ageMin: 40, ageMax: 30, incomeMin: 9, incomeMax: 1 })).toEqual({ ageMin: 40, incomeMin: 9 });
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `s${i}`, filters: { city: ['Mohali'] } }));
    expect(sanitizeSavedSearchList(many)).toHaveLength(5);
  });
});

describe('caste filter spellings', () => {
  it('covers the canonical name and every alias, nothing longer', () => {
    expect(casteFilterKeys('Jat Sikh').sort()).toEqual(['jat', 'jat sikh', 'jatt', 'jatt sikh']);
    expect(casteFilterKeys('Bhati')).toEqual(['bhati']);
    expect(casteFilterKeys('Some Rare Caste')).toEqual(['some rare caste']);
    expect(casteFilterKeys('  ')).toEqual([]);
  });
});
