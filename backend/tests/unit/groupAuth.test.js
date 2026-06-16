/**
 * Family-group authorization tests (REF-51)
 * The membership gate is what closes the original IDOR — verify it admits members
 * and rejects non-members.
 */

jest.mock('../../models', () => ({
  Group: {}, GroupMessage: {}, User: {}, Profile: {},
  GroupMember: { findOne: jest.fn() },
}));

const { GroupMember } = require('../../models');
const { requireMembership, groupRoom } = require('../../controllers/groupController');

describe('group membership gate', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns membership when the user belongs to the group', async () => {
    const membership = { groupId: 'g1', userId: 'u1', role: 'member' };
    GroupMember.findOne.mockResolvedValue(membership);
    await expect(requireMembership('g1', 'u1')).resolves.toBe(membership);
    expect(GroupMember.findOne).toHaveBeenCalledWith({ where: { groupId: 'g1', userId: 'u1' } });
  });

  it('throws 403 when the user is not a member (IDOR guard)', async () => {
    GroupMember.findOne.mockResolvedValue(null);
    await expect(requireMembership('g1', 'attacker')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('namespaces the socket room by group id', () => {
    expect(groupRoom('abc')).toBe('group_abc');
  });
});
