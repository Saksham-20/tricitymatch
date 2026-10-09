/**
 * Fixed launch term on the plans page: a plan sold with an end date reads
 * "until 10 Jan 2027", not "/3 months" (owner decision 2026-10-09).
 */
import { describe, it, expect } from 'vitest';
import '../../i18n';
import { termSuffix, planFeatures } from '../../utils/planFeatures';

const END = '2027-01-10T18:29:59.999Z'; // end of 10 Jan 2027 in India

describe('plan term display', () => {
  it('shows the end date when the plan has a fixed end', () => {
    expect(termSuffix({ endsOn: END, duration: 'until 10 January 2027' }, '90 days')).toBe(' until 10 Jan 2027');
  });

  it('shows the plan length otherwise', () => {
    expect(termSuffix({ duration: '3 months' }, '90 days')).toBe('/3 months');
  });

  it('rewrites the validity bullet to the end date', () => {
    const lines = planFeatures('premium_plus', false, { endsOn: END, contactUnlocks: -1 });
    expect(lines).toContain('Full access until 10 Jan 2027');
  });
});
