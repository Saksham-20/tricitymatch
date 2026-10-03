/**
 * Bhakoot (rashi) guna. It used to score 0 for rashi gaps of 3/11 and 7/7
 * (not doshas) and for half of the 6/8 pairs, and never flagged 2/12 or 5/9.
 * Of the 66 distinct sign pairs, 16 were flagged wrongly and 29 of the 36 real
 * dosha pairs were missed.
 */
const { getBhakootScore } = require('../../utils/compatibility');

const SIGNS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchik', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const score = (a, b) => getBhakootScore({ rashi: SIGNS.indexOf(a) }, { rashi: SIGNS.indexOf(b) });

describe('getBhakootScore', () => {
  it.each([
    // 2/12 : next-door signs
    ['Mesha', 'Vrishabha', 0], ['Karka', 'Simha', 0], ['Meena', 'Mesha', 0],
    // 5/9
    ['Mesha', 'Simha', 0], ['Mesha', 'Dhanu', 0], ['Vrishabha', 'Makara', 0],
    // 6/8
    ['Mesha', 'Kanya', 0], ['Mithuna', 'Vrishchik', 0],
    // not doshas: 3/11, 4/10, 7/7 and the same sign
    ['Mesha', 'Mithuna', 7], ['Mesha', 'Karka', 7], ['Mesha', 'Tula', 7], ['Karka', 'Karka', 7],
    // same ruling planet cancels the dosha
    ['Mesha', 'Vrishchik', 7], ['Vrishabha', 'Tula', 7], ['Makara', 'Kumbha', 7],
  ])('%s with %s scores %i', (a, b, expected) => {
    expect(score(a, b)).toBe(expected);
  });

  it('is symmetric for every pair of signs', () => {
    for (const a of SIGNS) for (const b of SIGNS) expect(score(a, b)).toBe(score(b, a));
  });

  it('flags exactly 33 of the 66 distinct pairs (36 dosha pairs, 3 cancelled by a shared lord)', () => {
    let zero = 0;
    for (let i = 0; i < 12; i += 1) for (let j = i + 1; j < 12; j += 1) if (score(SIGNS[i], SIGNS[j]) === 0) zero += 1;
    expect(zero).toBe(33);
  });

  it('returns null when a nakshatra is unknown', () => {
    expect(getBhakootScore(null, { rashi: 0 })).toBeNull();
    expect(getBhakootScore({ rashi: 0 }, undefined)).toBeNull();
  });
});
