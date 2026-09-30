/**
 * P1-1 OTP hardening.
 *
 * Every assertion here fails on the previous implementation: Math.random codes,
 * plaintext codes in the cache, read-then-write attempt counting (parallel
 * guesses all read the same count), a phone-only send budget, and foreign
 * numbers accepted.
 */

jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return {
    ...actual,
    sms: { ...actual.sms, provider: 'dev', bypassCodes: [], dailyBudget: 0, isConfigured: () => false },
    isDevelopment: true,
    server: { ...actual.server, isProduction: false },
  };
});
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const fs = require('fs');
const path = require('path');
const config = require('../../config/env');
const cache = require('../../utils/cache');
const otpStore = require('../../utils/otpStore');
const smsService = require('../../utils/smsService');

const settle = () => new Promise((r) => setImmediate(r));

describe('otpStore', () => {
  beforeEach(() => cache.delPattern('otp*'));

  it('stores a hash, never the code', async () => {
    const code = await otpStore.issue('email', 'a@b.co', { digits: 6 });
    const stored = await cache.get('otp:email:a@b.co');
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('issues codes of the requested length, never with a leading zero', async () => {
    for (let i = 0; i < 300; i++) {
      expect(otpStore.randomCode(4)).toMatch(/^[1-9]\d{3}$/);
      expect(otpStore.randomCode(6)).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it('does not use Math.random for codes', () => {
    const spy = jest.spyOn(Math, 'random');
    otpStore.randomCode(6);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    for (const f of ['utils/otpStore.js', 'utils/smsService.js', 'controllers/authController.js']) {
      const src = fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)\s*\*\s*9000|Math\.random\(\)\s*\*\s*900000/);
    }
  });

  it('accepts the right code once and refuses a replay', async () => {
    const code = await otpStore.issue('email', 'a@b.co', { digits: 6 });
    await expect(otpStore.verify('email', 'a@b.co', code)).resolves.toBeTruthy();
    await expect(otpStore.verify('email', 'a@b.co', code)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('parallel wrong guesses cannot exceed the attempt budget', async () => {
    const code = await otpStore.issue('phone', '919999999999', { digits: 4 });
    const wrong = code === '1111' ? '2222' : '1111';
    // 20 guesses in flight together: the old read-then-write let all of them
    // read attempts=0 and each be checked.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => otpStore.verify('phone', '919999999999', wrong))
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    // The real code no longer works: budget is spent and the code is burned.
    await expect(otpStore.verify('phone', '919999999999', code)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('two parallel correct submissions: exactly one wins', async () => {
    const code = await otpStore.issue('email', 'race@b.co', { digits: 6 });
    const results = await Promise.allSettled([
      otpStore.verify('email', 'race@b.co', code),
      otpStore.verify('email', 'race@b.co', code),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('a new code resets the attempt counter and invalidates the old code', async () => {
    const first = await otpStore.issue('email', 'r@b.co', { digits: 6 });
    await expect(otpStore.verify('email', 'r@b.co', '000000')).rejects.toBeTruthy();
    const second = await otpStore.issue('email', 'r@b.co', { digits: 6 });
    if (first !== second) await expect(otpStore.verify('email', 'r@b.co', first)).rejects.toBeTruthy();
    await expect(otpStore.verify('email', 'r@b.co', second)).resolves.toBeTruthy();
  });

  it('applies the same send budget to email targets (3 per hour)', async () => {
    for (let i = 0; i < otpStore.MAX_SENDS_PER_HOUR; i++) await otpStore.spendSend('email', 'x@y.co');
    await expect(otpStore.spendSend('email', 'x@y.co')).rejects.toMatchObject({ statusCode: 429 });
    // A different address has its own budget.
    await expect(otpStore.spendSend('email', 'z@y.co')).resolves.toBeUndefined();
  });

  it('parallel sends cannot exceed the send budget', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => otpStore.spendSend('phone', '918888888888'))
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(otpStore.MAX_SENDS_PER_HOUR);
  });
});

describe('smsService.sendOtp', () => {
  beforeEach(() => cache.delPattern('otp*'));

  it('rejects foreign numbers before any budget is spent or code stored', async () => {
    await expect(smsService.sendOtp('+14155552671')).rejects.toMatchObject({ statusCode: 400 });
    await expect(smsService.sendOtp('+447911123456')).rejects.toMatchObject({ statusCode: 400 });
    expect(await cache.get('otp_sends:phone:14155552671')).toBeNull();
    expect(await cache.get('otp:phone:14155552671')).toBeNull();
  });

  it('rejects an Indian-looking number that cannot be a mobile', async () => {
    await expect(smsService.sendOtp('1234567890')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts every common form of an Indian mobile and round-trips the code', async () => {
    await smsService.sendOtp('9814012345');
    // dev mode: read the hash and brute the 4-digit space through the public verify
    const stored = await cache.get('otp:phone:919814012345');
    expect(stored.hash).toBeTruthy();
    let found;
    for (let n = 1000; n < 10000 && !found; n++) {
      if (otpStore.hashCode('phone', '919814012345', String(n)) === stored.hash) found = String(n);
    }
    await expect(smsService.verifyOtp('+91 98140 12345', found)).resolves.toMatchObject({ success: true });
    await expect(smsService.verifyOtp('9814012345', found)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('limits parallel sends to one number to 3 per hour', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => smsService.sendOtp('9814099999'))
    );
    await settle();
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter((r) => r.status === 'rejected').every((r) => r.reason.statusCode === 429)).toBe(true);
  });
});

describe('global SMS budget', () => {
  it('refuses sends past the daily ceiling and counts only billed texts', async () => {
    jest.resetModules();
    jest.doMock('../../config/env', () => {
      const actual = jest.requireActual('../../config/env');
      return {
        ...actual,
        sms: { ...actual.sms, provider: 'fast2sms', apiKey: 'k', bypassCodes: [], dailyBudget: 2, isConfigured: () => true },
      };
    });
    jest.doMock('../../middlewares/logger', () => ({
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    const https = require('https');
    const reqMock = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    jest.spyOn(https, 'request').mockImplementation((opts, cb) => {
      const res = { on: (ev, fn) => { if (ev === 'data') fn('{"return":true}'); if (ev === 'end') fn(); } };
      cb(res);
      return reqMock;
    });
    const freshCache = require('../../utils/cache');
    await freshCache.delPattern('otp*');
    const sms = require('../../utils/smsService');

    await expect(sms.sendOtp('9814000001')).resolves.toMatchObject({ isDev: false });
    await expect(sms.sendOtp('9814000002')).resolves.toMatchObject({ isDev: false });
    await expect(sms.sendOtp('9814000003')).rejects.toMatchObject({ statusCode: 503 });
    https.request.mockRestore();
  });
});
