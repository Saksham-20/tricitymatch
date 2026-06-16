/**
 * BG-check webhook signature-verification unit tests (WH-1).
 * Locks in the fail-OPEN (dev) vs fail-CLOSED (prod) behaviour when the secret
 * is unset — the fix that stops a forged payload self-granting the
 * Background Verified badge in production.
 */

const mockConfig = {
  isProduction: false,
  bgCheck: { webhookSecret: null, provider: 'dev' },
};

jest.mock('../../config/env', () => mockConfig);
jest.mock('../../middlewares/logger', () => ({
  log: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const { verifyBgCheckWebhook } = require('../../utils/bgCheckService');

describe('verifyBgCheckWebhook (WH-1 fail-open vs fail-closed)', () => {
  afterEach(() => {
    mockConfig.isProduction = false;
    mockConfig.bgCheck.webhookSecret = null;
  });

  it('skips verification (returns true) in dev when no secret is set', () => {
    mockConfig.isProduction = false;
    mockConfig.bgCheck.webhookSecret = null;
    expect(verifyBgCheckWebhook(Buffer.from('{}'), 'anything')).toBe(true);
  });

  it('FAILS CLOSED (returns false) in production when no secret is set', () => {
    mockConfig.isProduction = true;
    mockConfig.bgCheck.webhookSecret = null;
    expect(verifyBgCheckWebhook(Buffer.from('{}'), 'forged-sig')).toBe(false);
  });
});
