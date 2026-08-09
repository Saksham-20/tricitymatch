/**
 * Chat entitlements + FREE_CHAT_FOR_MUTUALS (Phase 2, D8.4).
 *
 * Two things are load-bearing here and neither is obvious from the call sites:
 *
 * 1. The flag must ONLY ever widen chat. `requirePremium` gates calls,
 *    likes-you, profile viewers, contact unlock, the kundli PDF and invoices —
 *    if the flag ever leaks into that path, flipping it on gives all of them
 *    away. The last test in this file asserts the two gates disagree in exactly
 *    the intended direction.
 * 2. `getActiveSubscription` must filter on endDate in the QUERY. The hourly
 *    Bull sweep that flips expired rows to 'expired' is cleanup; if it hasn't
 *    run (or Redis is down) an expired row still says status:'active', and
 *    /auth/me used to report those members as premium while every gate 403'd.
 */

jest.mock('../../config/env', () => ({
  features: { freeChatForMutuals: false },
  founding: { isOpen: jest.fn(() => false) },
  isProduction: false,
  isDevelopment: true,
}));

jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn() },
  Match: { findOne: jest.fn() },
}));

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
}));

const { Op } = require('sequelize');
const config = require('../../config/env');
const { Subscription, Match } = require('../../models');
const { getActiveSubscription, hasChatAccess, isMutualMatch } = require('../../utils/entitlements');
const { PAID_PLANS, FOUNDING_PLAN } = require('../../constants/plans');

const PAID_ROW = { id: 'sub-1', planType: 'basic_premium', status: 'active', endDate: null };

beforeEach(() => {
  jest.clearAllMocks();
  config.features.freeChatForMutuals = false;
  Subscription.findOne.mockResolvedValue(null);
  Match.findOne.mockResolvedValue(null);
});

describe('getActiveSubscription', () => {
  it('filters expired rows in the query, not after it (the Bull sweep is cleanup, not correctness)', async () => {
    await getActiveSubscription('u1');

    const where = Subscription.findOne.mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(where.planType[Op.in]).toEqual(PAID_PLANS);
    // endDate is either NULL (lifetime) or strictly in the future.
    const [nullBranch, futureBranch] = where[Op.or];
    expect(nullBranch).toEqual({ endDate: null });
    expect(futureBranch.endDate[Op.gt]).toBeInstanceOf(Date);
  });

  it('accepts the founding grant as a paid-grade plan', () => {
    expect(PAID_PLANS).toContain(FOUNDING_PLAN);
  });

  it('fails CLOSED when the lookup throws — a DB blip is not an entitlement', async () => {
    Subscription.findOne.mockRejectedValue(new Error('connection reset'));
    await expect(getActiveSubscription('u1')).resolves.toBeNull();
  });

  it('returns null for a missing userId without touching the DB', async () => {
    await expect(getActiveSubscription(undefined)).resolves.toBeNull();
    expect(Subscription.findOne).not.toHaveBeenCalled();
  });
});

describe('isMutualMatch', () => {
  it('matches in either direction', async () => {
    Match.findOne.mockResolvedValue({ id: 'm1' });
    await expect(isMutualMatch('a', 'b')).resolves.toBe(true);

    const or = Match.findOne.mock.calls[0][0].where[Op.or];
    expect(or).toEqual([
      { userId: 'a', matchedUserId: 'b', isMutual: true },
      { userId: 'b', matchedUserId: 'a', isMutual: true },
    ]);
  });

  it('is false for self and for missing ids without a query', async () => {
    await expect(isMutualMatch('a', 'a')).resolves.toBe(false);
    await expect(isMutualMatch('a', null)).resolves.toBe(false);
    expect(Match.findOne).not.toHaveBeenCalled();
  });
});

describe('hasChatAccess — flag OFF (shipped default)', () => {
  it('allows a paid member', async () => {
    Subscription.findOne.mockResolvedValue(PAID_ROW);
    await expect(hasChatAccess('u1', 'u2')).resolves.toMatchObject({ allowed: true, reason: 'paid' });
  });

  it('denies a free member EVEN with a mutual match', async () => {
    Match.findOne.mockResolvedValue({ id: 'm1' });
    await expect(hasChatAccess('u1', 'u2')).resolves.toMatchObject({
      allowed: false,
      reason: 'premium_required',
    });
    // Flag off = premium is the whole answer; no mutual lookup is even needed.
    expect(Match.findOne).not.toHaveBeenCalled();
  });

  it('denies a free member listing conversations (no other user)', async () => {
    await expect(hasChatAccess('u1')).resolves.toMatchObject({ allowed: false });
  });
});

describe('hasChatAccess — flag ON', () => {
  beforeEach(() => {
    config.features.freeChatForMutuals = true;
  });

  it('allows a free member with a mutual match', async () => {
    Match.findOne.mockResolvedValue({ id: 'm1' });
    await expect(hasChatAccess('u1', 'u2')).resolves.toMatchObject({
      allowed: true,
      reason: 'free_chat_mutual',
      subscription: null,
    });
  });

  it('denies a free member with NO mutual match — the flag frees mutuals, not strangers', async () => {
    Match.findOne.mockResolvedValue(null);
    await expect(hasChatAccess('u1', 'u2')).resolves.toMatchObject({
      allowed: false,
      reason: 'not_mutual',
    });
  });

  it('allows the conversation LIST with no other user (the list is built from mutuals)', async () => {
    await expect(hasChatAccess('u1')).resolves.toMatchObject({
      allowed: true,
      reason: 'free_chat_flag',
    });
  });

  it('still prefers the paid answer when the member also pays', async () => {
    Subscription.findOne.mockResolvedValue(PAID_ROW);
    const access = await hasChatAccess('u1', 'u2');
    expect(access.reason).toBe('paid');
    expect(access.subscription).toBe(PAID_ROW);
  });
});

describe('blast radius — the flag widens chat and nothing else', () => {
  it('requirePremium never consults the flag: free + mutual + flag ON is still 403 there', async () => {
    config.features.freeChatForMutuals = true;
    Match.findOne.mockResolvedValue({ id: 'm1' });
    Subscription.findOne.mockResolvedValue(null);

    // Chat: allowed under the flag.
    await expect(hasChatAccess('u1', 'u2')).resolves.toMatchObject({ allowed: true });

    // requirePremium's own source of truth is the subscription row alone. Read
    // it the same way the middleware does — no flag input exists in that path.
    const source = require('fs').readFileSync(require.resolve('../../middlewares/auth.js'), 'utf8');
    const premiumBody = source.slice(
      source.indexOf('const requirePremium'),
      source.indexOf('const requireChatAccess')
    );
    expect(premiumBody).not.toMatch(/freeChatForMutuals|hasChatAccess/);
  });
});
