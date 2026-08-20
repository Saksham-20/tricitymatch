/**
 * Founding-member grant — the tests that guard the critical finding from the
 * 2026-08-09 eng review: Subscription.contactUnlocksAllowed NULL means
 * UNLIMITED (middlewares/auth.js), so the grant must write EXPLICIT caps.
 * A regression here silently hands every self-signup unlimited contact
 * unlocks — a scriptable phone-number harvest.
 */

jest.mock('../../config/env', () => ({
  founding: {
    endsAt: '2099-01-01',
    memberCap: 0,
    isOpen: jest.fn(() => true),
  },
}));

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../models', () => ({
  Subscription: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
  User: { update: jest.fn().mockResolvedValue([1]) },
}));

const config = require('../../config/env');
const { log } = require('../../middlewares/logger');
const { Subscription, User } = require('../../models');
const { grantFoundingIfOpen } = require('../../utils/foundingGrant');
const { FOUNDING_PLAN, FOUNDING_CONTACT_UNLOCKS } = require('../../constants/plans');

beforeEach(() => {
  jest.clearAllMocks();
  config.founding.isOpen.mockReturnValue(true);
  config.founding.memberCap = 0;
  Subscription.count.mockResolvedValue(0);
  Subscription.create.mockResolvedValue({});
  User.update.mockResolvedValue([1]);
});

describe('grantFoundingIfOpen — the explicit bundle', () => {
  it('creates the row with EXPLICIT caps — contactUnlocksAllowed is a number, never null/undefined', async () => {
    const granted = await grantFoundingIfOpen('user-1');
    expect(granted).toBe(true);

    expect(Subscription.create).toHaveBeenCalledTimes(1);
    const row = Subscription.create.mock.calls[0][0];
    expect(row.planType).toBe(FOUNDING_PLAN);
    expect(row.status).toBe('active');
    expect(row.contactUnlocksAllowed).toBe(FOUNDING_CONTACT_UNLOCKS);
    expect(typeof row.contactUnlocksAllowed).toBe('number');
    expect(row.contactUnlocksAllowed).not.toBeNull();
    expect(row.contactUnlocksUsed).toBe(0);
    // amount 0, not NULL — admin revenue sums stay correct
    expect(row.amount).toBe(0);
    expect(row.autoRenew).toBe(false);
    // Per-member term: signup + grantDays (default 30), NOT the cohort deadline.
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(row.endDate.getTime() - expected)).toBeLessThan(60 * 1000);
  });

  it('clamps the per-member term to the window deadline (a last-day signup cannot out-live the offer)', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // window ends in 2 days
    const { __setCacheForTests } = require('../../utils/launchOffer');
    __setCacheForTests({
      enabled: true,
      founding: { enabled: true, endsAt: soon.toISOString(), memberCap: 0, grantDays: 30, contactUnlocks: 3 },
    });

    await grantFoundingIfOpen('user-1');
    const row = Subscription.create.mock.calls[0][0];
    expect(row.endDate.getTime()).toBe(soon.getTime());
    expect(row.contactUnlocksAllowed).toBe(3);

    __setCacheForTests(null);
  });

  it('stamps Users.isFoundingMember so the badge survives upgrade/expiry', async () => {
    await grantFoundingIfOpen('user-1');
    expect(User.update).toHaveBeenCalledWith(
      { isFoundingMember: true },
      expect.objectContaining({ where: { id: 'user-1' } })
    );
  });

  it('passes the signup transaction through to both writes', async () => {
    const tx = { id: 'tx' };
    await grantFoundingIfOpen('user-1', { transaction: tx });
    expect(Subscription.create.mock.calls[0][1]).toEqual({ transaction: tx });
    expect(User.update.mock.calls[0][1]).toEqual(expect.objectContaining({ transaction: tx }));
  });
});

describe('grantFoundingIfOpen — the gates', () => {
  it('no-ops when the founding window is closed', async () => {
    config.founding.isOpen.mockReturnValue(false);
    const granted = await grantFoundingIfOpen('user-1');
    expect(granted).toBe(false);
    expect(Subscription.create).not.toHaveBeenCalled();
    expect(User.update).not.toHaveBeenCalled();
  });

  it('no-ops at the member cap', async () => {
    config.founding.memberCap = 100;
    Subscription.count.mockResolvedValue(100);
    const granted = await grantFoundingIfOpen('user-1');
    expect(granted).toBe(false);
    expect(Subscription.create).not.toHaveBeenCalled();
  });

  it('grants below the cap', async () => {
    config.founding.memberCap = 100;
    Subscription.count.mockResolvedValue(99);
    expect(await grantFoundingIfOpen('user-1')).toBe(true);
  });

  it('no-ops without a userId', async () => {
    expect(await grantFoundingIfOpen(null)).toBe(false);
    expect(Subscription.create).not.toHaveBeenCalled();
  });
});

describe('grantFoundingIfOpen — never throws into signup', () => {
  it('swallows and warns on DB failure', async () => {
    Subscription.create.mockRejectedValue(new Error('db down'));
    await expect(grantFoundingIfOpen('user-1')).resolves.toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      'Founding grant failed (signup unaffected)',
      expect.objectContaining({ userId: 'user-1' })
    );
  });
});

describe('invite tokens never collide with the profileCode namespace', () => {
  const { toProfileCode, parseProfileCode } = require('../../utils/profileCode');

  it('a 32-hex invite-shaped token never parses as a profile code', () => {
    const inviteShaped = 'a3f48dce50486e62ac23200feb3ab48e';
    expect(parseProfileCode(inviteShaped)).toBeNull();
    expect(parseProfileCode(`TCS-${inviteShaped}`)).toBeNull();
  });

  it("a user's profile code and an invite token can never be equal", () => {
    const code = toProfileCode('a3f48dce-5048-4662-ac23-200feb3ab48e');
    // profileCode: TCS- prefix + 8 chars; invite token: 32 raw hex, no prefix
    expect(code).toMatch(/^TCS-/);
    expect(code).not.toMatch(/^[0-9a-f]{32}$/i);
  });
});
