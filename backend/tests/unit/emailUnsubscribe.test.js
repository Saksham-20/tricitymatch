'use strict';

/**
 * Reminder-mail opt-out. The link is signed (no token table, no expiry); the
 * promotional mails carry it in the footer AND in List-Unsubscribe headers
 * (RFC 8058) so Gmail/Yahoo's own "Unsubscribe" button works; the one-click
 * endpoint accepts an Origin-less POST because mailbox providers send it from
 * their servers. Mail about a member's own money or account is not optional and
 * carries no opt-out.
 */

const fs = require('fs');
const path = require('path');

jest.mock('../../utils/userLedger', () => ({ patchUserLedger: jest.fn().mockResolvedValue([[], 1]) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { patchUserLedger } = require('../../utils/userLedger');
const { tokenFor, verifyToken, linksFor } = require('../../utils/emailUnsubscribe');
const { unsubscribe, resubscribe, openConfirmation } = require('../../controllers/emailController');

const UID = '3f0c9a52-8d6e-4b1a-9c77-2a5d1e6f4b10';
const OTHER = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

describe('signed link', () => {
  it('is a stable 128-bit hex token, different per member', () => {
    expect(tokenFor(UID)).toMatch(/^[0-9a-f]{32}$/);
    expect(tokenFor(UID)).toBe(tokenFor(UID));
    expect(tokenFor(UID)).not.toBe(tokenFor(OTHER));
  });

  it('verifies its own token and nothing else', () => {
    expect(verifyToken(UID, tokenFor(UID))).toBe(true);
    expect(verifyToken(UID, tokenFor(OTHER))).toBe(false);               // another member's token
    expect(verifyToken(UID, tokenFor(UID).slice(0, 16))).toBe(false);    // truncated
    expect(verifyToken(UID, `${tokenFor(UID)}00`)).toBe(false);          // padded
    expect(verifyToken(UID, undefined)).toBe(false);
    expect(verifyToken(undefined, tokenFor(UID))).toBe(false);
    expect(verifyToken('not-a-uuid', tokenFor('not-a-uuid'))).toBe(false); // must be a real id
    expect(verifyToken(UID, { $ne: '' })).toBe(false);                    // object smuggled through the body
  });

  it('builds a page URL (confirmation) and a separate one-click endpoint URL', () => {
    const { pageUrl, oneClickUrl } = linksFor(UID);
    expect(pageUrl).toMatch(new RegExp(`/unsubscribe\\?u=${UID}&t=${tokenFor(UID)}$`));
    expect(oneClickUrl).toMatch(new RegExp(`/api/v1/email/unsubscribe\\?u=${UID}&t=${tokenFor(UID)}$`));
  });
});

// asyncHandler drops the inner promise, so let the microtask queue drain.
const call = async (handler, { query = {}, body = {} } = {}) => {
  const res = { json: jest.fn(), redirect: jest.fn() };
  const next = jest.fn();
  handler({ query, body }, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return { res, next };
};

describe('POST /email/unsubscribe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records the opt-out from the List-Unsubscribe URL (params in the query, form body ignored)', async () => {
    const { res, next } = await call(unsubscribe, {
      query: { u: UID, t: tokenFor(UID) },
      body: { 'List-Unsubscribe': 'One-Click' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(patchUserLedger).toHaveBeenCalledWith(UID, { emailOptOut: expect.any(String) });
    expect(res.json).toHaveBeenCalledWith({ success: true, unsubscribed: true });
  });

  it('records the opt-out from our confirmation page (params in a JSON body)', async () => {
    const { res } = await call(unsubscribe, { body: { u: UID, t: tokenFor(UID) } });

    expect(patchUserLedger).toHaveBeenCalledWith(UID, { emailOptOut: expect.any(String) });
    expect(res.json).toHaveBeenCalledWith({ success: true, unsubscribed: true });
  });

  it.each([
    ['a forged token', { u: UID, t: 'f'.repeat(32) }],
    ["another member's token", { u: UID, t: tokenFor(OTHER) }],
    ['no token', { u: UID }],
    ['no id', { t: tokenFor(UID) }],
    ['nothing', {}],
  ])('rejects %s with a 400 and touches nothing', async (_label, body) => {
    const { res, next } = await call(unsubscribe, { body });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(patchUserLedger).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('POST /email/resubscribe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes only the opt-out key', async () => {
    const { res } = await call(resubscribe, { body: { u: UID, t: tokenFor(UID) } });

    expect(patchUserLedger).toHaveBeenCalledWith(UID, {}, ['emailOptOut']);
    expect(res.json).toHaveBeenCalledWith({ success: true, unsubscribed: false });
  });

  it('needs the signed link too', async () => {
    const { next } = await call(resubscribe, { body: { u: UID, t: 'a'.repeat(32) } });
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(patchUserLedger).not.toHaveBeenCalled();
  });
});

describe('GET /email/unsubscribe (a client that opens the header URL)', () => {
  it('lands on the confirmation page and NEVER unsubscribes — link scanners prefetch GETs', async () => {
    const { res } = await call(openConfirmation, { query: { u: UID, t: tokenFor(UID) } });

    expect(patchUserLedger).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(302, expect.stringMatching(new RegExp(`/unsubscribe\\?u=${UID}&t=${tokenFor(UID)}$`)));
  });

  it('only redirects to our own frontend, and drops a malformed link rather than reflecting it', async () => {
    const { res } = await call(openConfirmation, { query: { u: 'https://evil.example', t: '<script>' } });

    const [, target] = res.redirect.mock.calls[0];
    expect(target).toMatch(/\/unsubscribe$/);
    expect(target).not.toContain('evil');
  });
});

describe('wiring', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

  it('mounts the routes under /email', () => {
    expect(read('routes', 'index.js')).toMatch(/router\.use\('\/email', emailRoutes\)/);
  });

  it('rate-limits all three endpoints', () => {
    const src = read('routes', 'emailRoutes.js');
    for (const line of src.split('\n').filter((l) => /^router\.(get|post)\(/.test(l))) {
      expect(line).toMatch(/emailPrefsLimiter/);
    }
    expect(src.match(/^router\.(get|post)\(/gm)).toHaveLength(3);
  });

  it('exempts the one-click endpoint from the strict no-Origin CORS rule (mailbox providers POST with no Origin)', () => {
    const src = read('server.js');
    expect(src).toMatch(/isWebhookPath = \(p\) => .*\\\/email\\\/unsubscribe\$/);
    // ...but resubscribe is browser-only and stays behind the strict policy.
    expect(src).not.toMatch(/email\\\/resubscribe/);
  });
});
