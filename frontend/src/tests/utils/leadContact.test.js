import { describe, it, expect } from 'vitest';
import { formatLeadPhone, leadEmail } from '../../utils/leadContact';

describe('lead contact display', () => {
  it('formats a stored 91-prefixed number and hides the N/A email placeholder', () => {
    expect(formatLeadPhone('919000000001')).toBe('+91 90000 00001');
    expect(formatLeadPhone('9000000001')).toBe('+91 90000 00001');
    expect(formatLeadPhone('')).toBe('');
    expect(leadEmail('N/A')).toBeNull();
    expect(leadEmail('a@b.in')).toBe('a@b.in');
  });
});
