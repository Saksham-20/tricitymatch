/**
 * smsService.normalizePhone unit tests
 * Regression guard for the OTP no-delivery bug: clients send inconsistent phone
 * formats (web posts bare 10-digit, mobile prepends +91). MSG91 needs 91XXXXXXXXXX
 * or it returns type:success but never delivers. normalizePhone canonicalizes once
 * so send + verify hit the same Redis key and the provider gets a routable number.
 */

const { normalizePhone } = require('../../utils/smsService');

describe('smsService.normalizePhone', () => {
  it('prepends 91 to a bare 10-digit Indian mobile (the web bug)', () => {
    expect(normalizePhone('7973472356')).toBe('917973472356');
  });

  it('keeps an already-canonical 91XXXXXXXXXX number', () => {
    expect(normalizePhone('917973472356')).toBe('917973472356');
  });

  it('strips + and spaces from E.164 input', () => {
    expect(normalizePhone('+91 79734 72356')).toBe('917973472356');
    expect(normalizePhone('+91-79734-72356')).toBe('917973472356');
  });

  it('strips a single leading national-trunk 0', () => {
    expect(normalizePhone('07973472356')).toBe('917973472356');
  });

  it('all forms of the same number map to one canonical key', () => {
    const forms = ['7973472356', '+917973472356', '917973472356', '07973472356', '91 79734 72356'];
    const out = forms.map(normalizePhone);
    expect(new Set(out).size).toBe(1);
    expect(out[0]).toBe('917973472356');
  });

  it('returns null for unusable input (caller must reject, no fake success)', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('abcdefghij')).toBeNull();
    expect(normalizePhone('99')).toBeNull();
  });

  it('preserves a non-India country code already present', () => {
    // 11–15 digit numbers with another country code pass through as digits
    expect(normalizePhone('+1 415 555 0100')).toBe('14155550100');
  });
});
