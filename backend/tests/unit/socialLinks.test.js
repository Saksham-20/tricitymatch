/**
 * Social connections helper unit tests.
 * Normalization (legacy + new shape, unsafe URL rejection) and per-link
 * visibility filtering.
 */

const {
  normalizeSocialLinks,
  visibleSocialLinks,
  toSafeUrl,
} = require('../../utils/socialLinks');

describe('toSafeUrl', () => {
  test('passes through https URLs', () => {
    expect(toSafeUrl('website', 'https://example.com')).toBe('https://example.com/');
  });

  test('builds a platform URL from a bare handle', () => {
    expect(toSafeUrl('instagram', 'priya')).toBe('https://instagram.com/priya');
    expect(toSafeUrl('instagram', '@priya')).toBe('https://instagram.com/priya');
    expect(toSafeUrl('twitter', 'priya')).toBe('https://x.com/priya');
  });

  test('treats a bare domain as a URL, not a handle (no host doubling)', () => {
    expect(toSafeUrl('facebook', 'facebook.com/aman')).toBe('https://facebook.com/aman');
    expect(toSafeUrl('linkedin', 'linkedin.com/in/x')).toBe('https://linkedin.com/in/x');
    expect(toSafeUrl('website', 'example.com')).toBe('https://example.com/');
  });

  test('rejects javascript: and other non-web schemes', () => {
    expect(toSafeUrl('website', 'javascript:alert(1)')).toBeNull();
    expect(toSafeUrl('website', 'data:text/html,x')).toBeNull();
  });

  test('empty / non-string → null', () => {
    expect(toSafeUrl('website', '')).toBeNull();
    expect(toSafeUrl('website', null)).toBeNull();
    expect(toSafeUrl('website', 42)).toBeNull();
  });
});

describe('normalizeSocialLinks', () => {
  test('legacy string shape → { url, visibility: matches_only }', () => {
    const out = normalizeSocialLinks({ instagram: 'https://instagram.com/priya' });
    expect(out.instagram).toEqual({ url: 'https://instagram.com/priya', visibility: 'matches_only' });
  });

  test('new shape keeps a valid visibility', () => {
    const out = normalizeSocialLinks({ linkedin: { url: 'https://linkedin.com/in/x', visibility: 'everyone' } });
    expect(out.linkedin.visibility).toBe('everyone');
  });

  test('clamps an invalid visibility to the default', () => {
    const out = normalizeSocialLinks({ facebook: { url: 'https://facebook.com/x', visibility: 'public' } });
    expect(out.facebook.visibility).toBe('matches_only');
  });

  test('drops unknown platforms and unsafe / empty urls', () => {
    const out = normalizeSocialLinks({
      instagram: 'https://instagram.com/ok',
      myspace: 'https://myspace.com/x',
      website: 'javascript:alert(1)',
      youtube: '',
    });
    expect(Object.keys(out)).toEqual(['instagram']);
  });

  test('nothing valid → null', () => {
    expect(normalizeSocialLinks({ website: '' })).toBeNull();
    expect(normalizeSocialLinks(null)).toBeNull();
    expect(normalizeSocialLinks('nope')).toBeNull();
  });
});

describe('visibleSocialLinks', () => {
  const raw = {
    instagram: { url: 'https://instagram.com/pub', visibility: 'everyone' },
    linkedin: { url: 'https://linkedin.com/in/m', visibility: 'matches_only' },
    facebook: { url: 'https://facebook.com/h', visibility: 'hidden' },
  };

  test('owner sees everything including hidden', () => {
    const out = visibleSocialLinks(raw, { isOwner: true });
    expect(Object.keys(out).sort()).toEqual(['facebook', 'instagram', 'linkedin']);
  });

  test('non-mutual viewer sees only everyone links', () => {
    const out = visibleSocialLinks(raw, { isOwner: false, isMutual: false });
    expect(Object.keys(out)).toEqual(['instagram']);
  });

  test('mutual viewer also sees matches_only links, never hidden', () => {
    const out = visibleSocialLinks(raw, { isOwner: false, isMutual: true });
    expect(Object.keys(out).sort()).toEqual(['instagram', 'linkedin']);
    expect(out.facebook).toBeUndefined();
  });

  test('no visible links → null', () => {
    const onlyHidden = { facebook: { url: 'https://facebook.com/h', visibility: 'hidden' } };
    expect(visibleSocialLinks(onlyHidden, { isMutual: true })).toBeNull();
  });
});
