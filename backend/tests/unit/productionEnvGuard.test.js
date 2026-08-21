/**
 * Production startup guard (H-4, H-5).
 *
 * The guard runs at module load and calls process.exit(1), so it can only be
 * exercised by booting config/env.js in a child process with a crafted env.
 *
 * What these pin:
 *  - OTP_BYPASS_CODES are master codes that verify ANY account. They used to be
 *    warn-only, and the warning itself lived inside the ALLOW_INSECURE_PROD
 *    branch — so with that flag off, shipping master OTP codes was silent.
 *  - ALLOW_INSECURE_PROD downgraded the webhook/SMS/email checks to warnings.
 *  - DB_PASSWORD only rejected 'root', so docker-compose's 'postgres' default
 *    passed; COOKIE_SECRET was length-checked but not placeholder-checked.
 *
 * Added 2026-08-21 (deep audit R1). Each of these was previously unvalidated:
 *  - CSRF_SECRET had no check at all and compose never passed it through, so
 *    production ran with it empty.
 *  - REDIS_PASSWORD defaulted to empty, and Redis holds plaintext OTP codes
 *    and login-lockout counters.
 *  - BCRYPT_ROUNDS had no floor, so BCRYPT_ROUNDS=1 was accepted.
 *  - DB_NAME could stay at the development default in production.
 *  - DB_DISABLE_SSL=true silently turned off database TLS.
 *  - CORS_ORIGIN could keep its localhost development default.
 *  - The three signing secrets could all be set to the same value.
 *  - .env.example's shipped COOKIE_SECRET cleared every placeholder token and
 *    the 32-char bar, so copying the template booted with a public secret.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../..');

const STRONG = {
  NODE_ENV: 'production',
  DB_HOST: 'h', DB_PORT: '5432', DB_USER: 'u', DB_NAME: 'n',
  DB_PASSWORD: 'Str0ngRealPass!xyz',
  JWT_SECRET: 'a'.repeat(48),
  COOKIE_SECRET: 'b'.repeat(48),
  CSRF_SECRET: 'c'.repeat(48),
  REDIS_PASSWORD: 'Str0ngRedisPass!xyz',
  CORS_ORIGIN: 'https://www.tricitymatch.com',
  FRONTEND_URL: 'https://tricitymatch.com',
  RAZORPAY_WEBHOOK_SECRET: 'realwebhooksecret123456',
  SMS_PROVIDER: 'msg91',
  SMS_API_KEY: 'realkey',
  RESEND_API_KEY: 're_realkey',
};

const boot = (overrides = {}) => {
  const res = spawnSync(
    process.execPath,
    ['-e', "require('./config/env'); console.log('BOOTED_OK');"],
    {
      cwd: BACKEND_ROOT,
      env: { PATH: process.env.PATH, ...STRONG, ...overrides },
      encoding: 'utf8',
      timeout: 30000,
    }
  );
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
};

describe('production env guard', () => {
  it('boots when every secret is real', () => {
    const { status, out } = boot();
    expect(out).toContain('BOOTED_OK');
    expect(status).toBe(0);
  });

  it('refuses to boot with OTP_BYPASS_CODES set (universal account takeover)', () => {
    const { status, out } = boot({ OTP_BYPASS_CODES: '000000' });
    expect(status).toBe(1);
    expect(out).toMatch(/OTP_BYPASS_CODES must be empty/);
  });

  it('refuses to boot with ALLOW_INSECURE_PROD enabled', () => {
    const { status, out } = boot({ ALLOW_INSECURE_PROD: 'true' });
    expect(status).toBe(1);
    expect(out).toMatch(/ALLOW_INSECURE_PROD must not be enabled/);
  });

  it('ALLOW_INSECURE_PROD can no longer downgrade a missing webhook secret', () => {
    const { status } = boot({ ALLOW_INSECURE_PROD: 'true', RAZORPAY_WEBHOOK_SECRET: '' });
    expect(status).toBe(1);
  });

  it('rejects the docker-compose default DB password', () => {
    const { status, out } = boot({ DB_PASSWORD: 'postgres' });
    expect(status).toBe(1);
    expect(out).toMatch(/DB_PASSWORD is a well-known default/);
  });

  it('rejects a long-but-placeholder COOKIE_SECRET', () => {
    const { status, out } = boot({ COOKIE_SECRET: 'example-example-example-example-x' });
    expect(status).toBe(1);
    expect(out).toMatch(/COOKIE_SECRET looks like a placeholder/);
  });

  it('rejects a placeholder JWT_SECRET that clears the length bar', () => {
    const { status, out } = boot({ JWT_SECRET: 'your-super-secret-jwt-key-change-this' });
    expect(status).toBe(1);
    expect(out).toMatch(/JWT_SECRET/);
  });

  it('still requires https FRONTEND_URL (Secure cookies depend on it)', () => {
    const { status, out } = boot({ FRONTEND_URL: 'http://tricitymatch.com' });
    expect(status).toBe(1);
    expect(out).toMatch(/FRONTEND_URL must use https/);
  });

  // ── Guards added by the 2026-08-21 deep audit ──

  it('rejects the COOKIE_SECRET value shipped in .env.example', () => {
    // 41 chars, and it contained none of the previous placeholder tokens, so
    // an operator copying the template booted with a publicly-known secret.
    const { status, out } = boot({
      COOKIE_SECRET: 'another-secure-random-string-for-cookies',
    });
    expect(status).toBe(1);
    expect(out).toMatch(/COOKIE_SECRET looks like a placeholder/);
  });

  it('requires CSRF_SECRET to be set', () => {
    const { status, out } = boot({ CSRF_SECRET: '' });
    expect(status).toBe(1);
    expect(out).toMatch(/CSRF_SECRET must be set/);
  });

  it('rejects the development CSRF_SECRET default', () => {
    const { status, out } = boot({ CSRF_SECRET: 'dev-csrf-secret' });
    expect(status).toBe(1);
    expect(out).toMatch(/CSRF_SECRET must not be the development default/);
  });

  it('rejects a short CSRF_SECRET', () => {
    const { status, out } = boot({ CSRF_SECRET: 'abc123' });
    expect(status).toBe(1);
    expect(out).toMatch(/CSRF_SECRET must be at least 32 characters/);
  });

  it('refuses to reuse one value across the signing secrets', () => {
    const shared = 'd'.repeat(48);
    const { status, out } = boot({
      JWT_SECRET: shared, COOKIE_SECRET: shared, CSRF_SECRET: shared,
    });
    expect(status).toBe(1);
    expect(out).toMatch(/COOKIE_SECRET must not reuse the same value as JWT_SECRET/);
    expect(out).toMatch(/CSRF_SECRET must not reuse the same value as JWT_SECRET/);
  });

  it('requires REDIS_PASSWORD (Redis stores OTP codes and lockout state)', () => {
    const { status, out } = boot({ REDIS_PASSWORD: '' });
    expect(status).toBe(1);
    expect(out).toMatch(/REDIS_PASSWORD must be set/);
  });

  it('enforces a bcrypt cost floor', () => {
    const { status, out } = boot({ BCRYPT_ROUNDS: '4' });
    expect(status).toBe(1);
    expect(out).toMatch(/BCRYPT_ROUNDS must be at least 10/);
  });

  it('rejects the development database name in production', () => {
    const { status, out } = boot({ DB_NAME: 'matrimony_dev' });
    expect(status).toBe(1);
    expect(out).toMatch(/DB_NAME is still the development default/);
  });

  it('rejects DB_DISABLE_SSL unless the private network is acknowledged', () => {
    const { status, out } = boot({ DB_DISABLE_SSL: 'true' });
    expect(status).toBe(1);
    expect(out).toMatch(/DB_DISABLE_SSL=true disables database TLS/);
  });

  it('allows DB_DISABLE_SSL once the private network is acknowledged', () => {
    const { status, out } = boot({
      DB_DISABLE_SSL: 'true',
      DB_SSL_INTERNAL_NETWORK_ACKNOWLEDGED: 'true',
    });
    expect(out).toContain('BOOTED_OK');
    expect(status).toBe(0);
  });

  it('rejects a localhost CORS_ORIGIN in production', () => {
    const { status, out } = boot({ CORS_ORIGIN: 'http://localhost:3000' });
    expect(status).toBe(1);
    expect(out).toMatch(/CORS_ORIGIN must not contain localhost/);
  });
});
