import { describe, it, expect } from 'vitest';
import { minAgeFor, pickerMinAge, minAgeMessage } from '../../utils/marriageableAge';
import { validateAge } from '../../utils/validators';

const yearsAgo = (years, dayOffset = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};

describe('marriageable age (21 men / 18 women / 21 other)', () => {
  it('sets the minimum by gender, strictest when unknown', () => {
    expect(minAgeFor('male')).toBe(21);
    expect(minAgeFor('female')).toBe(18);
    expect(minAgeFor('other')).toBe(21);
    expect(minAgeFor('')).toBe(21);
  });

  it('shows the loosest year list until a gender is chosen', () => {
    expect(pickerMinAge('')).toBe(18);
    expect(pickerMinAge('male')).toBe(21);
  });

  it('words the message from the minimum', () => {
    expect(minAgeMessage('male')).toBe('You must be at least 21 years old');
    expect(minAgeMessage('female')).toBe('You must be at least 18 years old');
  });

  it('a 20-year-old fails as a man and passes as a woman', () => {
    const dob = yearsAgo(20, -30);
    expect(validateAge(dob, minAgeFor('male'), 100)).toBe(false);
    expect(validateAge(dob, minAgeFor('female'), 100)).toBe(true);
  });
});
