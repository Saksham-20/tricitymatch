/**
 * Log redaction (M-7).
 *
 * There was no redaction anywhere in the backend: any secret passed through a
 * log's meta was written verbatim, and request logging emitted req.originalUrl
 * raw — leaking the secret for token-in-path routes like GET /invite/:token,
 * which also land in nginx access logs.
 *
 * Redaction lives in formatLogEntry so it covers every call site, including
 * ones added later. These tests pin that.
 */

const { redactValue, redactUrl } = require('../../middlewares/logger');

describe('redactValue', () => {
  it.each([
    'password', 'passwd', 'token', 'accessToken', 'refresh_token',
    'authorization', 'cookie', 'apiKey', 'api_key', 'secret',
    'otp', 'cvv', 'cardNumber', 'pin', 'jwt', 'signature',
  ])('redacts %s', (key) => {
    expect(redactValue({ [key]: 'sensitive' })[key]).toBe('[REDACTED]');
  });

  it('is case-insensitive', () => {
    expect(redactValue({ PASSWORD: 'x', Authorization: 'y' })).toEqual({
      PASSWORD: '[REDACTED]',
      Authorization: '[REDACTED]',
    });
  });

  it('keeps non-sensitive diagnostic fields intact', () => {
    const meta = { userId: 'u1', status: 500, route: '/api/v1/x', duration: 12 };
    expect(redactValue(meta)).toEqual(meta);
  });

  it('redacts nested and arrayed secrets', () => {
    expect(redactValue({ a: { b: { token: 't', ok: 1 } }, list: [{ secret: 's' }] }))
      .toEqual({ a: { b: { token: '[REDACTED]', ok: 1 } }, list: [{ secret: '[REDACTED]' }] });
  });

  it('preserves Error shape so stack traces stay debuggable', () => {
    const out = redactValue({ err: new Error('boom') });
    expect(out.err.message).toBe('boom');
    expect(typeof out.err.stack).toBe('string');
  });

  it('does not blow up on null/undefined/primitives', () => {
    expect(redactValue(null)).toBeNull();
    expect(redactValue({ a: null, b: undefined, c: 0 })).toEqual({ a: null, b: undefined, c: 0 });
  });

  it('terminates on a cyclic-depth structure', () => {
    let deep = { token: 'x' };
    for (let i = 0; i < 20; i += 1) deep = { nest: deep };
    expect(() => redactValue(deep)).not.toThrow();
  });
});

describe('redactUrl', () => {
  it('masks the token segment of an invite link', () => {
    expect(redactUrl('/invite/SECRET123')).toBe('/invite/[REDACTED]');
    expect(redactUrl('/api/v1/invite/SECRET123')).toBe('/api/v1/invite/[REDACTED]');
  });

  it('masks sensitive query params but keeps the rest readable', () => {
    expect(redactUrl('/x?token=abc&page=2')).toBe('/x?token=[REDACTED]&page=2');
  });

  it('leaves ordinary URLs untouched', () => {
    expect(redactUrl('/api/v1/search?city=Mohali&page=2'))
      .toBe('/api/v1/search?city=Mohali&page=2');
  });

  it('handles non-string input safely', () => {
    expect(redactUrl(undefined)).toBeUndefined();
    expect(redactUrl('')).toBe('');
  });
});
