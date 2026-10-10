/**
 * Sign-up and code limits sized for real venues (launch audit 2026-10-10).
 *
 *  - Signup: 20 real accounts per hour per address, not 5. A partner roadshow
 *    or a college signs families up from one Wi-Fi.
 *  - Checking a code has its own budget (30 per 10 min), separate from SENDING
 *    one (10 per 10 min, each send is an SMS or an email). Sharing one budget
 *    ran it dry after a few signups at one table.
 *  - IPv6 is limited per /64, the block one subscriber gets, not the library's
 *    /56 default under which neighbouring phones on one carrier shared a bucket.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const { signupLimiter, otpLimiter, otpVerifyLimiter } = require('../../middlewares/security');

// One listening server per app. Given a bare app, supertest binds and closes a
// fresh ephemeral port for EVERY request; across a busy parallel run one of
// those requests once reached a port another worker had just taken (a 404 from
// a route that exists).
const servers = [];
afterAll(() => Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve)))));

const appWith = (limiter, status = 200) => {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/x', limiter, (req, res) => res.status(status).json({ ok: true }));
  const server = app.listen(0);
  servers.push(server);
  return server;
};

const fire = (app, ip) => request(app).post('/x').set('X-Forwarded-For', ip);

describe('signupLimiter', () => {
  test('allows 20 created accounts an hour from one address, then refuses', async () => {
    const app = appWith(signupLimiter, 201);
    for (let i = 0; i < 20; i++) {
      expect((await fire(app, '203.0.113.10')).status).toBe(201);
    }
    const blocked = await fire(app, '203.0.113.10');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT');
  });

  test('refused signups do not use the budget', async () => {
    const app = appWith(signupLimiter, 409);
    for (let i = 0; i < 25; i++) {
      expect((await fire(app, '203.0.113.11')).status).toBe(409);
    }
  });
});

describe('send and verify budgets are separate', () => {
  test('a spent send budget does not block checking a code', async () => {
    const sendApp = appWith(otpLimiter);
    const verifyApp = appWith(otpVerifyLimiter);
    for (let i = 0; i < 10; i++) await fire(sendApp, '203.0.113.20');
    expect((await fire(sendApp, '203.0.113.20')).status).toBe(429);
    expect((await fire(verifyApp, '203.0.113.20')).status).toBe(200);
  });

  test('verify allows 30 checks per 10 minutes, then refuses', async () => {
    const app = appWith(otpVerifyLimiter);
    for (let i = 0; i < 30; i++) {
      expect((await fire(app, '203.0.113.21')).status).toBe(200);
    }
    expect((await fire(app, '203.0.113.21')).status).toBe(429);
  });

  test('POST /verify-otp is wired to the verify budget, /send-otp to the send budget', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'routes', 'authRoutes.js'), 'utf8');
    expect(src).toMatch(/router\.post\('\/send-otp', otpLimiter,/);
    expect(src).toMatch(/router\.post\(\s*'\/verify-otp',\s*otpVerifyLimiter,/);
  });
});

describe('IPv6 grouping', () => {
  test('two phones in neighbouring /64s of one /56 do not share a bucket', async () => {
    const app = appWith(otpLimiter);
    for (let i = 0; i < 10; i++) await fire(app, '2001:db8:aa:1::5');
    expect((await fire(app, '2001:db8:aa:1::5')).status).toBe(429);
    // Same /56 (2001:db8:aa:0000–00ff), different /64.
    expect((await fire(app, '2001:db8:aa:2::5')).status).toBe(200);
  });

  test('addresses inside one /64 still share a bucket', async () => {
    const app = appWith(otpLimiter);
    for (let i = 0; i < 10; i++) await fire(app, `2001:db8:bb:1::${i + 1}`);
    expect((await fire(app, '2001:db8:bb:1::ffff')).status).toBe(429);
  });
});
