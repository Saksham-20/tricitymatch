const { findContactInText } = require('../../utils/contactInText');

describe('contact details in profile text', () => {
  it.each([
    ['Hello 97410, 79680 it\'s a pleasure to meet you all', 'phone'],
    ['call 9876543210', 'phone'],
    ['+91 98765 43210', 'phone'],
    ['0 98765-43210', 'phone'],
    ['9 8 7 6 5 4 3 2 1 0', 'phone'],
    ['98765.43210 after 6pm', 'phone'],
    ['write to priya.k@gmail.com', 'email'],
    ['priyak at gmail dot com', 'email'],
    ['whatsapp me', 'messenger'],
    ['Instagram: priya_k', 'messenger'],
    ['wa.me/919876543210', 'phone'],
  ])('flags %p', (text, kind) => {
    expect(findContactInText(text)).toBe(kind);
  });

  it.each([
    'Born 12-05-1995, 5 10 tall',
    'Earning 8,00,000 - 9,00,000 a year',
    'Studied 2013-2017 at PU, working since 2018',
    'Two brothers, one sister. Love cricket and Instagram reels.',
    'Software engineer at Infosys, Sector 70 Mohali',
    '',
  ])('does not flag %p', (text) => {
    expect(findContactInText(text)).toBeNull();
  });
});
