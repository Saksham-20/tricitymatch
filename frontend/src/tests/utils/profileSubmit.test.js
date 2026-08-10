import { describe, it, expect } from 'vitest';
import { buildProfileFormData } from '../../utils/profileSubmit';

// Read multipart FormData entries for a key back into a plain array.
const entriesFor = (fd, key) => fd.getAll(key);

describe('buildProfileFormData', () => {
  it('appends non-empty array items individually', () => {
    const fd = buildProfileFormData({ interestTags: ['Reading', 'Yoga'] });
    expect(entriesFor(fd, 'interestTags')).toEqual(['Reading', 'Yoga']);
  });

  it('sends an explicit empty string for cleared clearable arrays (so backend clears them)', () => {
    const fd = buildProfileFormData({ interestTags: [], preferredCity: [], languages: [] });
    expect(entriesFor(fd, 'interestTags')).toEqual(['']);
    expect(entriesFor(fd, 'preferredCity')).toEqual(['']);
    expect(entriesFor(fd, 'languages')).toEqual(['']);
  });

  it('does NOT send an empty sentinel for photos (handled as uploads)', () => {
    const fd = buildProfileFormData({ photos: [] });
    expect(entriesFor(fd, 'photos')).toEqual([]);
  });

  it('skips non-whitelisted account/verification fields', () => {
    const fd = buildProfileFormData({ password: 'x', email: 'a@b.com', emailVerification: true, firstName: 'Aman' });
    expect(entriesFor(fd, 'password')).toEqual([]);
    expect(entriesFor(fd, 'email')).toEqual([]);
    expect(entriesFor(fd, 'emailVerification')).toEqual([]);
    expect(entriesFor(fd, 'firstName')).toEqual(['Aman']);
  });

  it('skips empty-string / null primitives', () => {
    const fd = buildProfileFormData({ bio: '', city: null, weight: '65' });
    expect(entriesFor(fd, 'bio')).toEqual([]);
    expect(entriesFor(fd, 'city')).toEqual([]);
    expect(entriesFor(fd, 'weight')).toEqual(['65']);
  });

  it('JSON-stringifies object fields', () => {
    const fd = buildProfileFormData({ socialMediaLinks: { instagram: { url: 'x', visibility: 'everyone' } } });
    expect(entriesFor(fd, 'socialMediaLinks')).toEqual([
      JSON.stringify({ instagram: { url: 'x', visibility: 'everyone' } }),
    ]);
  });
});
