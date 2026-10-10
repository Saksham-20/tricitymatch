/**
 * middlewares/loadShed — 503 fast under sustained event-loop lag, and never on
 * the routes where a refusal costs money or looks like a sign-out.
 */

jest.mock('../../middlewares/logger', () => ({ log: { warn: jest.fn() } }));

const { createLoadShedder, isSheddable } = require('../../middlewares/loadShed');

const run = (shedder, path) => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    set(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
  const next = jest.fn();
  shedder.middleware({ path }, res, next);
  return { res, next };
};

const withLags = (lags) => {
  let i = 0;
  return createLoadShedder({ thresholdMs: 500, sampleLagMs: () => lags[Math.min(i++, lags.length - 1)] });
};

describe('loadShed', () => {
  test('one slow window is not an overload', () => {
    const shedder = withLags([900, 50]);
    shedder.tick();
    expect(run(shedder, '/api/v1/search').next).toHaveBeenCalled();
  });

  test('two consecutive slow windows trip it: sheddable API calls get a 503 with Retry-After', () => {
    const shedder = withLags([900, 900]);
    shedder.tick();
    shedder.tick();
    const { res, next } = run(shedder, '/api/v1/search');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.headers['Retry-After']).toBe('5');
    expect(res.body).toEqual({
      success: false,
      error: expect.objectContaining({ code: 'SERVER_BUSY' }),
    });
    expect(shedder.state()).toEqual(expect.objectContaining({ shedding: true, refused: 1 }));
  });

  test('stays on until lag falls below half the threshold', () => {
    const shedder = withLags([900, 900, 400, 200]);
    shedder.tick();
    shedder.tick();
    shedder.tick(); // 400: under threshold, not under half — still shedding
    expect(shedder.state().shedding).toBe(true);
    shedder.tick(); // 200: under half — clears
    expect(shedder.state().shedding).toBe(false);
    expect(run(shedder, '/api/v1/search').next).toHaveBeenCalled();
  });

  test.each([
    '/health',
    '/monitoring/health/ready',
    '/api/monitoring/metrics',
    '/api/v1/subscription/webhook',
    '/api/subscription/webhook',
    '/api/v1/subscription/verify-payment',
    '/api/v1/subscription/cancel-order',
    '/api/v1/subscription/google-verify',
    '/api/v1/subscription/unlock-bundle/verify-payment',
    '/api/v1/astrologers/book/7c2d1c0e-0000-4000-8000-000000000000/verify-payment',
    '/api/v1/auth/refresh',
    '/api/auth/me',
    '/api/v1/auth/logout',
    '/uploads/a.jpg',
  ])('never refuses %s', (path) => {
    expect(isSheddable(path)).toBe(false);
    const shedder = withLags([900, 900]);
    shedder.tick();
    shedder.tick();
    expect(run(shedder, path).next).toHaveBeenCalled();
  });

  test.each([
    '/api/v1/search',
    '/api/v1/auth/login',
    '/api/v1/subscription/create-order',
    '/api/v1/profile/me',
    '/api/v1/auth/logout-all',
  ])('may refuse %s', (path) => {
    expect(isSheddable(path)).toBe(true);
  });

  test('does nothing while healthy', () => {
    const shedder = withLags([10, 10, 10]);
    shedder.tick();
    shedder.tick();
    shedder.tick();
    expect(run(shedder, '/api/v1/search').next).toHaveBeenCalled();
    expect(shedder.state()).toEqual({ shedding: false, lagMs: 10, refused: 0 });
  });

  test('the real histogram sampler starts and stops cleanly', () => {
    const shedder = createLoadShedder({ thresholdMs: 500, windowMs: 10 });
    shedder.start();
    shedder.start(); // idempotent
    shedder.tick();
    expect(shedder.state().shedding).toBe(false);
    shedder.stop();
  });
});
