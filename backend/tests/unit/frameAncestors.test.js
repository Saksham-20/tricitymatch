/**
 * Framing policy consistency (deep security audit 2026-08-21, R2 HEADER-1).
 *
 * Production sends both `X-Frame-Options: DENY` and, in the CSP,
 * `frame-ancestors 'self'`. CSP frame-ancestors SUPERSEDES X-Frame-Options in
 * every modern browser, so the effective policy was "same-origin framing is
 * allowed" while the header advertised DENY — and two headers disagreeing about
 * framing is the condition under which some browsers have historically dropped
 * the protection altogether. That mismatch existed because helmet defaults
 * frameAncestors to 'self' and the directive was never set explicitly.
 *
 * Nothing frames this application. Razorpay is framed BY us (frame-src), never
 * the other way round.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
  requestLogger: (req, res, next) => next(),
}));

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8');

describe('backend CSP', () => {
  const source = read('backend/middlewares/security.js');

  it("sets frame-ancestors explicitly to 'none'", () => {
    expect(source).toMatch(/frameAncestors:\s*\["'none'"\]/);
  });

  it('still sends X-Frame-Options: DENY, which must agree with it', () => {
    expect(source).toMatch(/frameguard:\s*\{\s*action:\s*'deny'\s*\}/);
  });
});

describe('nginx configuration agrees with the application', () => {
  it('the shared security-headers snippet denies framing', () => {
    expect(read('nginx/conf.d/security-headers.conf')).toContain("frame-ancestors 'none'");
  });

  it('no nginx config still advertises SAMEORIGIN', () => {
    for (const file of ['nginx/nginx.conf', 'frontend/nginx.conf', 'nginx/conf.d/security-headers.conf']) {
      expect(read(file)).not.toContain('X-Frame-Options "SAMEORIGIN"');
    }
  });
});
