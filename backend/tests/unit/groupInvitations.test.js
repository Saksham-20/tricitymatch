/**
 * Family-group invitations need consent (platform audit 2026-09-29, P0-4).
 *
 * An owner used to be able to put ANY member into a group with no accept step,
 * after which that group's messages were readable to them immediately, and the
 * response (201 + member row for a hit, 400 for a miss) turned the endpoint into
 * a phone-number -> user-id oracle. Invitations are now pending until accepted,
 * grant nothing while pending, and every target-dependent outcome is the same
 * 202.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
}));

jest.mock('../../models', () => ({
  Group: { findByPk: jest.fn(), findAll: jest.fn() },
  GroupMember: { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn(), count: jest.fn() },
  GroupMessage: { findAndCountAll: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Profile: { findAll: jest.fn() },
  Block: { findOne: jest.fn() },
}));

jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

const models = require('../../models');
const { notify } = require('../../utils/notifyUser');
const groups = require('../../controllers/groupController');

const OWNER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const GROUP = '99999999-9999-4999-8999-999999999999';

// asyncHandler does not return its promise; flush so the chain has settled.
const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  let thrown = null;
  handler(req, res, (err) => { thrown = err; });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, thrown };
};

// The caller's own membership lookup vs. the "is the target already in" lookup.
const membershipLookups = ({ caller, existingForTarget = null }) => ({ where }) => {
  if (where.userId === OWNER) return Promise.resolve(caller);
  return Promise.resolve(existingForTarget);
};

const invite = (body) => ({ params: { groupId: GROUP }, body, user: { id: OWNER, role: 'user' } });

beforeEach(() => {
  jest.clearAllMocks();
  models.GroupMember.findOne.mockImplementation(membershipLookups({ caller: { role: 'owner' } }));
  models.GroupMember.count.mockResolvedValue(2);
  models.GroupMember.create.mockResolvedValue({});
  models.User.findByPk.mockResolvedValue({ id: TARGET, status: 'active', role: 'user' });
  models.User.findOne.mockResolvedValue({ id: TARGET, status: 'active', role: 'user' });
  models.Group.findByPk.mockResolvedValue({ name: 'Sharma family' });
  models.Block.findOne.mockResolvedValue(null);
});

describe('inviting a member', () => {
  it('creates a PENDING row, never an active one, and tells the invitee nothing is shared yet', async () => {
    const { res } = await run(groups.addMember, invite({ userId: TARGET }));

    expect(models.GroupMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: GROUP, userId: TARGET, status: 'pending', invitedBy: OWNER })
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(notify).toHaveBeenCalledWith(TARGET, 'system', expect.any(String), expect.stringContaining('until you accept'), GROUP);
  });

  it('only the owner may invite', async () => {
    models.GroupMember.findOne.mockImplementation(membershipLookups({ caller: { role: 'member' } }));
    const { thrown } = await run(groups.addMember, invite({ userId: TARGET }));
    expect(thrown).toMatchObject({ statusCode: 403 });
    expect(models.GroupMember.create).not.toHaveBeenCalled();
  });

  describe('a hit and every kind of miss are indistinguishable (no user oracle)', () => {
    const reply = async (setup, body = { phone: '9876543210' }) => {
      setup();
      const { res, thrown } = await run(groups.addMember, invite(body));
      return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0], thrown };
    };

    it('same status and body for: found, not found, blocked, banned, staff, self, already-in-group', async () => {
      const found = await reply(() => {});
      const notFound = await reply(() => models.User.findOne.mockResolvedValue(null));
      const blocked = await reply(() => models.Block.findOne.mockResolvedValue({ id: 'b1' }));
      const banned = await reply(() => models.User.findOne.mockResolvedValue({ id: TARGET, status: 'banned', role: 'user' }));
      const staff = await reply(() => models.User.findOne.mockResolvedValue({ id: TARGET, status: 'active', role: 'admin' }));
      const self = await reply(() => models.User.findOne.mockResolvedValue({ id: OWNER, status: 'active', role: 'user' }));
      const already = await reply(() => models.GroupMember.findOne.mockImplementation(
        membershipLookups({ caller: { role: 'owner' }, existingForTarget: { id: 'x' } })
      ));

      for (const r of [found, notFound, blocked, banned, staff, self, already]) {
        expect(r.thrown).toBeNull();
        expect(r.status).toBe(202);
        expect(r.body).toEqual(found.body);
      }
    });

    it('never echoes the invited member row or user id', async () => {
      const { res } = await run(groups.addMember, invite({ userId: TARGET }));
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(TARGET);
    });

    it('creates nothing for any of the miss cases', async () => {
      models.User.findOne.mockResolvedValue(null);
      await run(groups.addMember, invite({ phone: '9876543210' }));
      models.Block.findOne.mockResolvedValue({ id: 'b1' });
      models.User.findOne.mockResolvedValue({ id: TARGET, status: 'active', role: 'user' });
      await run(groups.addMember, invite({ phone: '9876543210' }));
      expect(models.GroupMember.create).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });
  });

  it('counts pending invitations against the group cap', async () => {
    models.GroupMember.count.mockResolvedValue(20);
    const { thrown } = await run(groups.addMember, invite({ userId: TARGET }));
    expect(thrown).toMatchObject({ statusCode: 400 });
    // No status filter on the count: pending rows occupy a slot too.
    expect(models.GroupMember.count).toHaveBeenCalledWith({ where: { groupId: GROUP } });
  });
});

describe('a pending invitation grants no access', () => {
  it('membership lookups require an ACTIVE row', async () => {
    models.GroupMember.findOne.mockResolvedValue(null);
    const { thrown } = await run(groups.getMessages, { params: { groupId: GROUP }, query: {}, user: { id: TARGET } });
    expect(thrown).toMatchObject({ statusCode: 403 });
    expect(models.GroupMember.findOne).toHaveBeenCalledWith({
      where: { groupId: GROUP, userId: TARGET, status: 'active' },
    });
    expect(models.GroupMessage.findAndCountAll).not.toHaveBeenCalled();
  });

  it('non-owners are not shown members who have not accepted', async () => {
    models.GroupMember.findOne.mockResolvedValue({ role: 'member' });
    models.Group.findByPk.mockResolvedValue({
      toJSON: () => ({ id: GROUP, Members: [{ userId: OWNER, status: 'active' }, { userId: TARGET, status: 'pending' }] }),
    });
    const { res } = await run(groups.getGroup, { params: { groupId: GROUP }, user: { id: OWNER } });
    const members = res.json.mock.calls[0][0].group.Members;
    expect(members.map((m) => m.userId)).toEqual([OWNER]);
  });

  it('the owner can see who is still pending', async () => {
    models.GroupMember.findOne.mockResolvedValue({ role: 'owner' });
    models.Group.findByPk.mockResolvedValue({
      toJSON: () => ({ id: GROUP, Members: [{ userId: OWNER, status: 'active' }, { userId: TARGET, status: 'pending' }] }),
    });
    const { res } = await run(groups.getGroup, { params: { groupId: GROUP }, user: { id: OWNER } });
    expect(res.json.mock.calls[0][0].group.Members).toHaveLength(2);
  });
});

describe('answering an invitation', () => {
  const respond = (handler) => run(handler, { params: { groupId: GROUP }, user: { id: TARGET } });

  it('accept activates the membership', async () => {
    const row = { status: 'pending', invitedBy: OWNER, save: jest.fn(), destroy: jest.fn() };
    models.GroupMember.findOne.mockResolvedValue(row);
    const { res } = await respond(groups.acceptInvitation);
    expect(row.status).toBe('active');
    expect(row.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('accept only looks at PENDING rows for the caller', async () => {
    models.GroupMember.findOne.mockResolvedValue(null);
    const { thrown } = await respond(groups.acceptInvitation);
    expect(thrown).toMatchObject({ statusCode: 404 });
    expect(models.GroupMember.findOne).toHaveBeenCalledWith({
      where: { groupId: GROUP, userId: TARGET, status: 'pending' },
    });
  });

  it('accept is refused, and the invite removed, if a block appeared since it was sent', async () => {
    const row = { status: 'pending', invitedBy: OWNER, save: jest.fn(), destroy: jest.fn() };
    models.GroupMember.findOne.mockResolvedValue(row);
    models.Block.findOne.mockResolvedValue({ id: 'b1' });
    const { thrown } = await respond(groups.acceptInvitation);
    expect(thrown).toMatchObject({ statusCode: 404 });
    expect(row.destroy).toHaveBeenCalled();
    expect(row.save).not.toHaveBeenCalled();
  });

  it('decline deletes the invitation', async () => {
    const row = { status: 'pending', destroy: jest.fn() };
    models.GroupMember.findOne.mockResolvedValue(row);
    await respond(groups.declineInvitation);
    expect(row.destroy).toHaveBeenCalled();
  });

  it('lists only the caller\'s pending invitations', async () => {
    models.GroupMember.findAll.mockResolvedValue([{ groupId: GROUP, invitedBy: OWNER, createdAt: 'now' }]);
    models.Group.findAll.mockResolvedValue([{ id: GROUP, name: 'Sharma family' }]);
    models.Profile.findAll.mockResolvedValue([{ userId: OWNER, firstName: 'Asha', lastName: 'Sharma' }]);
    const { res } = await run(groups.getMyInvitations, { user: { id: TARGET } });
    expect(models.GroupMember.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TARGET, status: 'pending' } })
    );
    expect(res.json.mock.calls[0][0].invitations[0]).toMatchObject({
      groupId: GROUP, groupName: 'Sharma family', invitedByName: 'Asha Sharma',
    });
  });
});
