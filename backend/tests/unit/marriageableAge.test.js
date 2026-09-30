/**
 * Age policy (audit P0-10): 21 men, 18 women, 21 other; DOB and gender locked
 * once onboarding completes. The published Terms say exactly this; the code
 * enforced a flat 18 in four places.
 */

const { marriageableAgeProblem, ageOn, minAgeFor } = require('../../constants/marriageableAge');
const { applyIdentityRules } = require('../../utils/identityLock');

const NOW = new Date('2026-09-29T12:00:00Z');

describe('ageOn', () => {
  it('is exact on the birthday, one day either side', () => {
    expect(ageOn('2005-09-29', NOW)).toBe(21);
    expect(ageOn('2005-09-30', NOW)).toBe(20);
    expect(ageOn('2005-09-28', NOW)).toBe(21);
  });

  it('handles a leap-day birthday', () => {
    expect(ageOn('2004-02-29', new Date('2026-02-28T00:00:00Z'))).toBe(21);
    expect(ageOn('2004-02-29', new Date('2026-03-01T00:00:00Z'))).toBe(22);
  });

  it('returns null for garbage', () => {
    expect(ageOn('not a date', NOW)).toBeNull();
  });
});

describe('marriageableAgeProblem', () => {
  it('men need 21', () => {
    expect(marriageableAgeProblem('male', '2005-09-30', NOW)).toMatch(/at least 21/);
    expect(marriageableAgeProblem('male', '2005-09-29', NOW)).toBeNull();
  });

  it('women need 18', () => {
    expect(marriageableAgeProblem('female', '2008-09-30', NOW)).toMatch(/at least 18/);
    expect(marriageableAgeProblem('female', '2008-09-29', NOW)).toBeNull();
    expect(marriageableAgeProblem('female', '2006-01-01', NOW)).toBeNull(); // 20: fine for a woman
  });

  it('other and unknown gender are held to 21', () => {
    expect(minAgeFor('other')).toBe(21);
    expect(minAgeFor(undefined)).toBe(21);
    expect(marriageableAgeProblem('other', '2006-01-01', NOW)).toMatch(/at least 21/);
    expect(marriageableAgeProblem(null, '2006-01-01', NOW)).toMatch(/at least 21/);
  });

  it('rejects impossible ages and ignores an absent date', () => {
    expect(marriageableAgeProblem('male', '1890-01-01', NOW)).toBe('Invalid date of birth');
    expect(marriageableAgeProblem('male', 'nope', NOW)).toBe('Invalid date of birth');
    expect(marriageableAgeProblem('male', null, NOW)).toBeNull();
    expect(marriageableAgeProblem('male', '', NOW)).toBeNull();
  });
});

describe('identity lock (applyIdentityRules)', () => {
  const onboarded = { onboardingComplete: true, gender: 'female', dateOfBirth: new Date('1998-05-01T00:00:00Z') };
  const fresh = { onboardingComplete: false, gender: null, dateOfBirth: null };

  it('refuses to change date of birth or gender after onboarding', () => {
    expect(() => applyIdentityRules(onboarded, { dateOfBirth: '1997-05-01' })).toThrow(/cannot be changed/);
    expect(() => applyIdentityRules(onboarded, { gender: 'male' })).toThrow(/cannot be changed/);
    try { applyIdentityRules(onboarded, { gender: 'male' }); } catch (e) { expect(e.statusCode).toBe(403); expect(e.code).toBe('IDENTITY_LOCKED'); }
  });

  it('drops an unchanged value so a resubmitted form is a no-op (any date format)', () => {
    const update = { dateOfBirth: '1998-05-01T00:00:00.000Z', gender: 'female', city: 'Mohali' };
    applyIdentityRules(onboarded, update);
    expect(update).toEqual({ city: 'Mohali' });
    const update2 = { dateOfBirth: '1998-05-01', gender: 'female' };
    applyIdentityRules(onboarded, update2);
    expect(update2).toEqual({});
  });

  it('treats UTC-midnight and IST-midnight spellings of one calendar day as the same value', () => {
    const istStored = { onboardingComplete: true, gender: 'male', dateOfBirth: new Date('2000-09-26T18:30:00Z') };
    const update = { dateOfBirth: '2000-09-27', gender: 'male' };
    expect(() => applyIdentityRules(istStored, update)).not.toThrow();
    expect(update).toEqual({});
    expect(() => applyIdentityRules(istStored, { dateOfBirth: '2000-09-28' })).toThrow(/cannot be changed/);
  });

  it('does not re-block a legacy under-age member who resubmits unchanged values', () => {
    const legacy = { onboardingComplete: true, gender: 'male', dateOfBirth: new Date('2010-01-01T00:00:00Z') };
    const update = { dateOfBirth: '2010-01-01', gender: 'male', bio: 'hi' };
    expect(() => applyIdentityRules(legacy, update)).not.toThrow();
  });

  it('lets a member set the values before onboarding completes, under the age rule', () => {
    expect(() => applyIdentityRules(fresh, { gender: 'male', dateOfBirth: '2000-01-01' })).not.toThrow();
    expect(() => applyIdentityRules(fresh, { gender: 'male', dateOfBirth: '2010-01-01' })).toThrow(/at least 21/);
    expect(() => applyIdentityRules(fresh, { gender: 'female', dateOfBirth: '2007-01-01' })).not.toThrow();
  });

  it('judges a new gender against the stored date of birth (no dodging via gender)', () => {
    // Not onboarded yet, DOB says 19: fine as female, refused if switched to male.
    const p = { onboardingComplete: false, gender: 'female', dateOfBirth: new Date('2007-06-01T00:00:00Z') };
    expect(() => applyIdentityRules(p, { gender: 'male' })).toThrow(/at least 21/);
  });

  it('allows the first setting of a value that was never stored, even after onboarding', () => {
    const p = { onboardingComplete: true, gender: null, dateOfBirth: null };
    expect(() => applyIdentityRules(p, { gender: 'female', dateOfBirth: '2000-01-01' })).not.toThrow();
  });
});
