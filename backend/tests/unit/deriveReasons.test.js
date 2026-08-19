/**
 * D4 — reason chips. Pure derivation from getCompatibilityBreakdown output:
 * priority-ordered, threshold 70, capped at 3, throw-safe on bad data.
 */

const { deriveReasons } = require('../../utils/compatibility');

const catify = (categories) => ({ overall: 80, categories, ashtakoot: null });

describe('deriveReasons', () => {
  it('returns [] on null / malformed breakdowns (throw-safe)', () => {
    expect(deriveReasons(null)).toEqual([]);
    expect(deriveReasons({})).toEqual([]);
    expect(deriveReasons({ categories: null })).toEqual([]);
    expect(deriveReasons({ categories: { location: 'garbage' } })).toEqual([]);
  });

  it('excludes categories under the 70 threshold', () => {
    const reasons = deriveReasons(catify({
      location: { score: 50, detail: 'Same state' },
      lifestyle: { score: 69, detail: 'Matching: diet' },
    }));
    expect(reasons).toEqual([]);
  });

  it('labels: same city, kundli score, community, lifestyle, age', () => {
    expect(deriveReasons(catify({ location: { score: 100, detail: 'Same city' } }))).toEqual(['Same city']);
    expect(deriveReasons(catify({
      horoscope: { score: 85, detail: 'Ashtakoot: 28/36 (Excellent) · Manglik: Compatible' },
    }))).toEqual(['Kundli 28/36']);
    expect(deriveReasons(catify({
      community: { score: 100, detail: 'Same religion & caste' },
    }))).toEqual(['Same community']);
    expect(deriveReasons(catify({
      community: { score: 70, detail: 'Same religion, different caste' },
    }))).toEqual(['Same religion']);
    expect(deriveReasons(catify({
      lifestyle: { score: 100, detail: 'Matching: diet, smoking habits' },
    }))).toEqual(['Lifestyle match']);
    expect(deriveReasons(catify({ age: { score: 75, detail: '4 years difference' } }))).toEqual(['Similar age']);
  });

  it('respects priority order and caps at 3', () => {
    const reasons = deriveReasons(catify({
      age: { score: 100, detail: '1 year difference' },
      lifestyle: { score: 100, detail: 'Matching: diet' },
      community: { score: 100, detail: 'Same religion & caste' },
      horoscope: { score: 90, detail: 'Ashtakoot: 30/36 (Excellent) · Manglik: Compatible' },
      location: { score: 100, detail: 'Same city' },
    }));
    expect(reasons).toEqual(['Same city', 'Kundli 30/36', 'Same community']);
  });

  it('rashi-fallback horoscope details still label as Horoscope match', () => {
    expect(deriveReasons(catify({
      horoscope: { score: 80, detail: 'Rashi: 80% compatible · Manglik: Compatible' },
    }))).toEqual(['Horoscope match']);
  });
});
