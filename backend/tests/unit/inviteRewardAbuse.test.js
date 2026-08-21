/**
 * Invite-reward abuse gates (deep security audit 2026-08-21, R2 LOGIC-1).
 *
 * The reward pays 3 contact unlocks to BOTH sides of an accepted invite. Two
 * facts made that a free-unlock printer:
 *
 *   1. Signup does not REQUIRE a verified contact — the OTP-verified markers
 *      are consumed opportunistically, and an account is created either way.
 *   2. Nothing capped how many invites one member could be rewarded for.
 *
 * So a member could point their own invite link at throwaway signups and mint
 * unlocks indefinitely. Contact unlocks are phone numbers, which is exactly the
 * directory export the unlimited-tier daily cap exists to stop.
 *
 * These tests pin both gates, and pin that the eligibility check fails CLOSED.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockUser = { findByPk: jest.fn(), increment: jest.fn(), count: jest.fn() };
const mockSubscription = { findOne: jest.fn() };
jest.mock('../../models', () => ({ User: mockUser, Subscription: mockSubscription }));

jest.mock('../../config/database', () => ({
  transaction: (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }),
}));

jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

const { rewardInvite, INVITE_REWARD_MAX_PER_INVITER } = require('../../utils/inviteReward');

const verifiedInvitee = { id: 'new', emailVerified: true, phoneVerified: false };

// creditUnlocks lands on an active finite subscription when one exists.
const givePayableSubscription = () => {
  mockSubscription.findOne.mockImplementation(async () => ({
    contactUnlocksAllowed: 5,
    save: jest.fn(),
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.increment.mockResolvedValue([1]);
  givePayableSubscription();
});

describe('rewardInvite eligibility', () => {
  it('pays nothing when the invitee never verified a contact', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 'new', emailVerified: false, phoneVerified: false });
    mockUser.count.mockResolvedValue(0);

    await rewardInvite('new', 'inviter');

    expect(mockSubscription.findOne).not.toHaveBeenCalled();
    expect(mockUser.increment).not.toHaveBeenCalled();
  });

  it('pays nothing when the invitee row cannot be found', async () => {
    mockUser.findByPk.mockResolvedValue(null);
    mockUser.count.mockResolvedValue(0);

    await rewardInvite('new', 'inviter');

    expect(mockSubscription.findOne).not.toHaveBeenCalled();
  });

  it('pays nothing once the inviter is at the lifetime cap', async () => {
    mockUser.findByPk.mockResolvedValue(verifiedInvitee);
    mockUser.count.mockResolvedValue(INVITE_REWARD_MAX_PER_INVITER());

    await rewardInvite('new', 'inviter');

    expect(mockSubscription.findOne).not.toHaveBeenCalled();
  });

  it('excludes the account being rewarded from the prior-invite count', async () => {
    mockUser.findByPk.mockResolvedValue(verifiedInvitee);
    mockUser.count.mockResolvedValue(0);

    await rewardInvite('new', 'inviter');

    const where = mockUser.count.mock.calls[0][0].where;
    expect(where.invitedBy).toBe('inviter');
    // id: { [Op.ne]: 'new' } — Op.ne is a Symbol key.
    const idClause = where.id;
    const neSymbol = Object.getOwnPropertySymbols(idClause)[0];
    expect(idClause[neSymbol]).toBe('new');
  });

  it('fails closed when the eligibility check itself throws', async () => {
    mockUser.findByPk.mockRejectedValue(new Error('db down'));

    await rewardInvite('new', 'inviter');

    expect(mockSubscription.findOne).not.toHaveBeenCalled();
    expect(mockUser.increment).not.toHaveBeenCalled();
  });

  it('still rewards a verified invitee under the cap', async () => {
    mockUser.findByPk.mockResolvedValue(verifiedInvitee);
    mockUser.count.mockResolvedValue(1);

    await rewardInvite('new', 'inviter');

    // Both sides credited.
    expect(mockSubscription.findOne).toHaveBeenCalledTimes(2);
  });

  it('accepts a phone-verified invitee as well as an email-verified one', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 'new', emailVerified: false, phoneVerified: true });
    mockUser.count.mockResolvedValue(0);

    await rewardInvite('new', 'inviter');

    expect(mockSubscription.findOne).toHaveBeenCalledTimes(2);
  });
});
