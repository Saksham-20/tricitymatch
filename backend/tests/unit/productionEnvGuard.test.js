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
});
