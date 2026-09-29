import { ageOnIso, minAgeFor } from './marriageableAge';

describe('marriageable age', () => {
  const today = new Date(2026, 8, 29); // 29 Sep 2026

  it('is 21 for men and 18 for women; unknown is the stricter 21', () => {
    expect(minAgeFor('male')).toBe(21);
    expect(minAgeFor('female')).toBe(18);
    expect(minAgeFor(null)).toBe(21);
  });

  it('counts birthdays exactly', () => {
    expect(ageOnIso('2005-09-29', today)).toBe(21);
    expect(ageOnIso('2005-09-30', today)).toBe(20);
    expect(ageOnIso('2008-09-29', today)).toBe(18);
  });
});
