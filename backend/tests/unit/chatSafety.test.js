const { assessMessage } = require('../../utils/chatSafety');

const flagsOf = (text) => assessMessage(text).flags;

describe('assessMessage: ordinary chat is left alone', () => {
  it.each([
    'Hi, how are you? Nice to meet you.',
    'My mother would like to speak with your family this weekend',
    'You can call me on 9876543210 after 6pm',
    'Mail me at asha.sharma@gmail.com',
    'I work at a bank in Sector 17. Do you like Chandigarh?',
    'The registration for the hall is next month, we will visit together',
    'Let us keep it simple: coffee at 5?',
    '',
    '   ',
  ])('no flags for %j', (text) => {
    expect(flagsOf(text)).toEqual([]);
  });
});

describe('assessMessage: payment signals', () => {
  it.each([
    ['please send me money for my ticket', 'payment_request'],
    ['I need money urgently, hospital emergency', 'payment_request'],
    ['transfer the amount today', 'payment_request'],
    ['pay a small processing fee and it will be released', 'payment_request'],
    ['customs clearance charges are pending', 'payment_request'],
    ['buy an itunes gift card and share the code', 'payment_request'],
    ['join our forex trading platform', 'payment_request'],
    ['paise bhej do please', 'payment_request'],
    ['send via western union', 'payment_request'],
    ['pay to asha@okhdfcbank', 'upi_id'],
    ['my upi is 9876543210@ybl', 'upi_id'],
    ['IFSC HDFC0001234', 'bank_details'],
    ['a/c no 123456789012 please', 'bank_details'],
    ['gpay on 9876543210', 'bank_details'],
  ])('flags %j as %s', (text, code) => {
    expect(flagsOf(text)).toContain(code);
    expect(assessMessage(text).high).toBe(true);
  });

  it('cannot be dodged with zero-width characters or full-width letters', () => {
    expect(flagsOf('send me mo​ney')).toContain('payment_request');
    expect(flagsOf('ｓｅｎｄ ｍｅ ｍｏｎｅｙ')).toContain('payment_request');
  });
});

describe('assessMessage: links', () => {
  it('a plain link is a low signal', () => {
    const r = assessMessage('my biodata is at https://drive.google.com/file/abc');
    expect(r.flags).toEqual(['external_link']);
    expect(r.high).toBe(false);
    expect(flagsOf('see www.example.com/bio')).toEqual(['external_link']);
  });

  it.each([
    'open bit.ly/3xYz now',
    'http://192.168.1.5/kyc',
    'https://xn--sbi-kyc-9ta.com/login',
    'https://sbi-kyc-verify.online/login',
    'go to https://secure-hdfc-update.top/verify',
    'https://a-b-c-d-e.example.com/x',
  ])('a suspicious link is a strong signal: %s', (text) => {
    expect(flagsOf(text)).toContain('suspicious_link');
    expect(assessMessage(text).high).toBe(true);
  });

  it('an email address is not a link', () => {
    expect(flagsOf('write to riya@example.co.in')).toEqual([]);
  });

  it('lists strong signals before weak ones', () => {
    const r = assessMessage('see www.example.com and send me money');
    expect(r.flags[0]).toBe('payment_request');
    expect(r.flags).toContain('external_link');
  });
});
