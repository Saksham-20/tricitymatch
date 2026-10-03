import { describe, it, expect } from 'vitest';
import { buildProfileFormData } from '../utils/profileSubmit';

const keys = (fd) => [...fd.keys()];

describe('buildProfileFormData', () => {
  it('without a baseline, empty values are not sent (signup)', () => {
    const fd = buildProfileFormData({ firstName: 'Asha', bio: '', gotra: '' });
    expect(keys(fd)).toEqual(['firstName']);
  });

  it('with a baseline, a field the member emptied is sent as an explicit empty', () => {
    const baseline = { firstName: 'Asha', bio: 'Hello there', gotra: 'Kashyap', weight: 60, income: 500000 };
    const fd = buildProfileFormData(
      { firstName: 'Asha', bio: '', gotra: '', weight: '', income: 500000 },
      { baseline }
    );
    expect(fd.get('bio')).toBe('');
    expect(fd.get('gotra')).toBe('');
    expect(fd.get('weight')).toBe('');
    expect(fd.get('income')).toBe('500000');
  });

  it('a field that was empty and stays empty is not sent', () => {
    const fd = buildProfileFormData({ bio: '' }, { baseline: { bio: '' } });
    expect(fd.has('bio')).toBe(false);
  });

  it('never blanks identity or city, and ignores non-whitelisted keys', () => {
    const fd = buildProfileFormData(
      { firstName: '', dateOfBirth: '', city: '', gender: '', password: 'x' },
      { baseline: { firstName: 'Asha', dateOfBirth: '1996-01-01', city: 'Mohali', gender: 'female' } }
    );
    expect(keys(fd)).toEqual([]);
  });

  it('does not clear JSON/array fields through the scalar path', () => {
    const fd = buildProfileFormData(
      { profilePrompts: null, socialMediaLinks: undefined },
      { baseline: { profilePrompts: [{ q: 'a' }], socialMediaLinks: { x: 1 } } }
    );
    expect(keys(fd)).toEqual([]);
  });
});
