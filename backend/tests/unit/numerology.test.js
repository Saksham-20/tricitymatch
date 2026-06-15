/**
 * Numerology Unit Tests
 * Life-path number from DOB + pairwise compatibility.
 */

const {
  reduceToCore,
  getLifePath,
  numerologyCompatibility,
  getNumerologyMatch,
} = require('../../utils/numerology');

describe('numerology', () => {
  describe('reduceToCore', () => {
    it('reduces multi-digit numbers (folding to single digit unless master)', () => {
      expect(reduceToCore(38)).toBe(11); // 3+8=11 -> master, kept
      expect(reduceToCore(19)).toBe(1);  // 1+9=10 -> 1+0=1
      expect(reduceToCore(7)).toBe(7);
      expect(reduceToCore(48)).toBe(3);  // 4+8=12 -> 1+2=3
    });
    it('preserves master numbers 11, 22, 33', () => {
      expect(reduceToCore(11)).toBe(11);
      expect(reduceToCore(22)).toBe(22);
      expect(reduceToCore(33)).toBe(33);
    });
  });

  describe('getLifePath', () => {
    it('computes a life-path number with title/summary', () => {
      const lp = getLifePath('1990-05-15');
      // 1990->1, 5->5, 15->6 => 12 -> 3
      expect(lp).toMatchObject({ number: 3 });
      expect(typeof lp.title).toBe('string');
      expect(lp.title.length).toBeGreaterThan(0);
    });
    it('returns null for missing/invalid dates', () => {
      expect(getLifePath(null)).toBeNull();
      expect(getLifePath('not-a-date')).toBeNull();
    });
  });

  describe('numerologyCompatibility', () => {
    it('scores identical paths highly', () => {
      const c = numerologyCompatibility(5, 5);
      expect(c.score).toBeGreaterThanOrEqual(80);
      expect(c.label).toBeTruthy();
    });
    it('returns null when a number is missing', () => {
      expect(numerologyCompatibility(null, 5)).toBeNull();
    });
  });

  describe('getNumerologyMatch', () => {
    it('returns both persons + compatibility for two DOBs', () => {
      const m = getNumerologyMatch('1990-05-15', '1992-08-20');
      expect(m).toHaveProperty('person1.number');
      expect(m).toHaveProperty('person2.number');
      expect(m).toHaveProperty('compatibility.score');
    });
    it('returns null when a DOB is missing', () => {
      expect(getNumerologyMatch('1990-05-15', null)).toBeNull();
    });
  });
});
