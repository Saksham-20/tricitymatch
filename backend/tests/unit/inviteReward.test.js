/**
 * Invite reward — contact-unlock credits.
 *
 * The invariant under test: there is exactly ONE place a gate reads an unlock
 * entitlement from — `Subscription.contactUnlocksAllowed`. A credit earned
 * before the member has a subscription parks on `Users.pendingUnlockCredits`
 * and is MOVED, never read in parallel. If that ever stops holding, a member
 * sees credits the gate cannot spend (or spends credits twice).
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockUser = { findByPk: jest.fn(), increment: jest.fn() };
const mockSubscription = { findOne: jest.fn() };
jest.mock('../../models', () => ({ User: mockUser, Subscription: mockSubscription }));

// A transaction double. Real Sequelize exposes LOCK; this deliberately does
// not, to keep the unlocked-degradation path covered.
const tx = {};
jest.mock('../../config/database', () => ({
  transaction: (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }),
}));

jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

const { applyPendingCredits, creditUnlocks, INVITE_REWARD_UNLOCKS } = require('../../utils/inviteReward');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('applyPendingCredits', () => {
  it('moves the balance onto the subscription and zeroes it', async () => {
    const user = { id: 'u1', pendingUnlockCredits: 3, save: jest.fn() };
    mockUser.findByPk.mockResolvedValue(user);
    const sub = { contactUnlocksAllowed: 10, save: jest.fn() };

    const applied = await applyPendingCredits('u1', sub, tx);

    expect(applied).toBe(3);
    expect(sub.contactUnlocksAllowed).toBe(13);
    expect(sub.save).toHaveBeenCalledWith({ transaction: tx });
    // Zeroed in the SAME transaction — otherwise a retry spends it twice.
    expect(user.pendingUnlockCredits).toBe(0);
    expect(user.save).toHaveBeenCalledWith({ transaction: tx });
  });

  it('is a no-op when there is nothing pending', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 'u1', pendingUnlockCredits: 0, save: jest.fn() });
    const sub = { contactUnlocksAllowed: 10, save: jest.fn() };

    expect(await applyPendingCredits('u1', sub, tx)).toBe(0);
    expect(sub.save).not.toHaveBeenCalled();
  });

  it('leaves the balance alone on an UNLIMITED plan rather than burning it', async () => {
    // null means unlimited: there is no counter to add to, so the credit has to
    // survive for whatever finite plan the member holds next.
    const sub = { contactUnlocksAllowed: null, save: jest.fn() };

    expect(await applyPendingCredits('u1', sub, tx)).toBe(0);
    expect(mockUser.findByPk).not.toHaveBeenCalled();
    expect(sub.save).not.toHaveBeenCalled();
  });
});

describe('creditUnlocks', () => {
  it('lands on an active finite subscription when one exists', async () => {
    const sub = { contactUnlocksAllowed: 5, save: jest.fn() };
    mockSubscription.findOne.mockResolvedValue(sub);

    expect(await creditUnlocks('u1', 3)).toBe('applied');
    expect(sub.contactUnlocksAllowed).toBe(8);
    expect(mockUser.increment).not.toHaveBeenCalled();
  });

  it('parks as pending when the member has no subscription to hold it', async () => {
    mockSubscription.findOne.mockResolvedValue(null);

    expect(await creditUnlocks('u1', 3)).toBe('pending');
    expect(mockUser.increment).toHaveBeenCalledWith(
      { pendingUnlockCredits: 3 },
      expect.objectContaining({ where: { id: 'u1' } })
    );
  });

  it('refuses non-positive and non-integer credits without touching the DB', async () => {
    expect(await creditUnlocks('u1', 0)).toBe('failed');
    expect(await creditUnlocks('u1', -5)).toBe('failed');
    expect(await creditUnlocks('u1', 1.5)).toBe('failed');
    expect(await creditUnlocks(null, 3)).toBe('failed');
    expect(mockSubscription.findOne).not.toHaveBeenCalled();
    expect(mockUser.increment).not.toHaveBeenCalled();
  });

  it('never throws — a failed reward must not break the signup it runs off', async () => {
    mockSubscription.findOne.mockRejectedValue(new Error('db down'));
    expect(await creditUnlocks('u1', 3)).toBe('failed');
  });
});

describe('reward size', () => {
  it('is a positive integer by default, so the invite has a reason to exist', () => {
    const n = INVITE_REWARD_UNLOCKS();
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });
});
