import { describe, it, expect } from 'vitest';
import { findContactInText } from '../../utils/contactInText';

// Same cases as backend/tests/unit/contactInText.test.js: the two copies must agree.
describe('contact details in profile text (client copy)', () => {
  it.each([
    ["Hello 97410, 79680 it's a pleasure to meet you all", 'phone'],
    ['+91 98765 43210', 'phone'],
    ['nine eight seven six five four three two one zero', 'phone'],
    ['write to priya.k@gmail.com', 'email'],
    ['Instagram: priya_k', 'messenger'],
    ['see instagram.com/priya_k', 'link'],
    ['pay priya@okhdfcbank', 'upi'],
  ])('flags %s', (text, kind) => {
    expect(findContactInText(text)).toBe(kind);
  });

  it.each([
    'Earning 8,00,000 - 9,00,000 a year',
    'B.Com from DAV, M.Com from PU, B.Sc, M.Tech, B.A.',
    'Two brothers, one sister. Love cricket and Instagram reels.',
  ])('does not flag %s', (text) => {
    expect(findContactInText(text)).toBeNull();
  });
});
