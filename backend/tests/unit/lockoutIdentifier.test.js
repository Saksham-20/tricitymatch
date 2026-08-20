/**
 * Account-lockout key derivation (H-2).
 *
 * checkAccountLockout read req.body.email only, but the flexible login accepts
 * `identifier` (email OR phone) and every modern client sends that — so the
 * gate bailed out on effectively every real login and lockout never fired.
 * recordFailedLogin was writing keys nothing read. These tests pin the shared
 * derivation so the middleware and the controller cannot drift apart again.
 */

jest.mock('../../config/env', () => ({
  isProduction: false,
  isDevelopment: true,
  security: { disableRateLimits: false },
  auth: { maxLoginAttempts: 5, lockoutDuration: 10 },
  redis: {},
  server: {},
}));

jest.mock('../../utils/cache', () => ({
  getString: jest.fn().mockResolvedValue(null),
  setString: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  getNumber: jest.fn(),
  setNumber: jest.fn(),
}));

const { loginLookupKey } = require('../../middlewares/security');

describe('loginLookupKey', () => {
  it('lowercases an email identifier', () => {
    expect(loginLookupKey({ identifier: 'Foo@Example.COM' })).toBe('foo@example.com');
  });

  it('accepts a phone identifier verbatim (the case that was never locked out)', () => {
    expect(loginLookupKey({ identifier: '9876543210' })).toBe('9876543210');
  });

  it('prefers identifier over the legacy email field', () => {
    expect(loginLookupKey({ identifier: 'new@x.com', email: 'old@x.com' })).toBe('new@x.com');
  });

  it('still supports legacy clients that send only email', () => {
    expect(loginLookupKey({ email: 'Legacy@X.com' })).toBe('legacy@x.com');
  });

  it('trims surrounding whitespace so padding cannot fork the key', () => {
    expect(loginLookupKey({ identifier: '  a@b.com  ' })).toBe('a@b.com');
  });

  it('returns null when no identifier is present', () => {
    expect(loginLookupKey({})).toBeNull();
    expect(loginLookupKey({ identifier: '   ' })).toBeNull();
  });

  it('is stable across the middleware/controller boundary', () => {
    // The controller records failures against this exact value; the middleware
    // must compute the same string from the same body or the lockout is a no-op.
    const body = { identifier: 'Attacker@Example.com', password: 'x' };
    expect(loginLookupKey(body)).toBe(loginLookupKey({ identifier: body.identifier }));
  });
});
