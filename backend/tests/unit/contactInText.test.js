const { findContactInText, maskContactInText } = require('../../utils/contactInText');

describe('contact details in profile text', () => {
  it.each([
    ['Hello 97410, 79680 it\'s a pleasure to meet you all', 'phone'],
    ['call 9876543210', 'phone'],
    ['+91 98765 43210', 'phone'],
    ['0 98765-43210', 'phone'],
    ['9 8 7 6 5 4 3 2 1 0', 'phone'],
    ['98765.43210 after 6pm', 'phone'],
    ['nine eight seven six five four three two one zero', 'phone'],
    ['Nau aath saat chhe paanch chaar teen do ek shunya', 'phone'],
    ['wa.me/919876543210', 'phone'],
    ['write to priya.k@gmail.com', 'email'],
    ['priyak at gmail dot com', 'email'],
    ['whatsapp me', 'messenger'],
    ['Instagram: priya_k', 'messenger'],
    ['FB id priya.k', 'messenger'],
    ['see instagram.com/priya_k', 'link'],
    ['my site https://priya.example', 'link'],
    ['www.priyak.in', 'link'],
    ['pay priya@okhdfcbank', 'upi'],
  ])('flags %p', (text, kind) => {
    expect(findContactInText(text)).toBe(kind);
  });

  it.each([
    'Born 12-05-1995, 5 10 tall',
    'Earning 8,00,000 - 9,00,000 a year',
    'Studied 2013-2017 at PU, working since 2018',
    'Two brothers, one sister. Love cricket and Instagram reels.',
    'Software engineer at Infosys, Sector 70 Mohali',
    'B.Com from DAV, M.Com from PU, B.Sc, M.Tech, B.A.',
    'One of three siblings; my two nieces are seven and nine.',
    '',
  ])('does not flag %p', (text) => {
    expect(findContactInText(text)).toBeNull();
  });

  it('masks stored contact details and leaves the rest of the text alone', () => {
    expect(maskContactInText('Hello 97410, 79680 nice to meet you')).toBe('Hello [hidden] nice to meet you');
    expect(maskContactInText('mail priya.k@gmail.com or instagram.com/pk')).toBe('mail [hidden] or [hidden]');
    expect(maskContactInText('B.Com graduate, 5 10, born 1995')).toBe('B.Com graduate, 5 10, born 1995');
    expect(maskContactInText(null)).toBeNull();
  });
});
