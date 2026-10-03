import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../../utils/sanitize';

/**
 * sanitizeText feeds React text children, which escape for themselves. It used
 * to return DOMPurify's HTML string, so "Tom & Jerry" displayed as "Tom &amp; Jerry".
 */
describe('sanitizeText', () => {
  it.each([
    ["It's fine", "It's fine"],
    ['Tom & Jerry', 'Tom & Jerry'],
    ['say "hello"', 'say "hello"'],
    ['5 > 3', '5 > 3'],
    ['  leading and trailing  ', '  leading and trailing  '],
    ['line one\nline two', 'line one\nline two'],
  ])('shows %j as typed', (input, expected) => {
    expect(sanitizeText(input)).toBe(expected);
  });

  it('still removes markup and script', () => {
    expect(sanitizeText('hi <b>there</b>')).toBe('hi there');
    expect(sanitizeText('<img src=x onerror=alert(1)>ok')).toBe('ok');
    expect(sanitizeText('<script>alert(1)</script>safe')).toBe('safe');
  });

  it('does not turn an escaped tag back into live markup it then hands to React as text', () => {
    // The output is for text nodes; an encoded "<script>" in the input stays text.
    expect(sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
  });

  it('returns an empty string for non-strings', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(5)).toBe('');
  });
});
