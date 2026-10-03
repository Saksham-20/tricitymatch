/**
 * Group sockets are membership-checked once, at join, so removal / leaving /
 * deleting a group has to evict the sockets too (feature interrogation CHAT-02),
 * and invite-by-phone must find the account login would (CHAT-19).
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
}));

jest.mock('../../models', () => ({
  Group: { findByPk: jest.fn() },
  GroupMember: { findOne: jest.fn(), count: jest.fn(), create: jest.fn() },
  GroupMessage: {},
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Profile: {},
  Block: { findOne: jest.fn() },
  Match: {}, ChatGrant: {}, CallSession: {},
}));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

const models = require('../../models');
const { setIO } = require('../../utils/socket');
const groups = require('../../controllers/groupController');

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const GROUP = '99999999-9999-4999-8999-999999999999';

const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  let thrown = null;
  handler(req, res, (err) => { thrown = err; });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, thrown };
};

const fakeSocket = (userId) => ({
  rooms: new Set([`user_${userId}`, `group_${GROUP}`]),
  leave: jest.fn(),
});

let sockets;
let emitted;
const installIO = () => {
  sockets = [fakeSocket(MEMBER), fakeSocket(MEMBER), fakeSocket(OTHER), fakeSocket(OWNER)];
  emitted = [];
  const io = {
    in: jest.fn(() => ({ fetchSockets: jest.fn().mockResolvedValue(sockets) })),
    to: jest.fn(() => ({ emit: (...a) => emitted.push(a) })),
  };
  setIO(io);
  return io;
};

beforeEach(() => {
  jest.clearAllMocks();
  installIO();
});
afterAll(() => setIO(null));

describe('CHAT-02 group room eviction', () => {
  it('owner removing a member evicts only that member\'s sockets', async () => {
    models.GroupMember.findOne
      .mockResolvedValueOnce({ role: 'owner' }) // requireMembership(owner)
      .mockResolvedValueOnce({ role: 'member', destroy: jest.fn().mockResolvedValue() }); // target
    const { res, thrown } = await run(groups.removeMember, {
      params: { groupId: GROUP, memberUserId: MEMBER }, user: { id: OWNER },
    });
    expect(thrown).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(sockets[0].leave).toHaveBeenCalledWith(`group_${GROUP}`);
    expect(sockets[1].leave).toHaveBeenCalledWith(`group_${GROUP}`);
    expect(sockets[2].leave).not.toHaveBeenCalled();
    expect(sockets[3].leave).not.toHaveBeenCalled();
  });

  it('leaving evicts the leaver\'s sockets', async () => {
    models.GroupMember.findOne.mockResolvedValueOnce({ role: 'member', destroy: jest.fn().mockResolvedValue() });
    const { thrown } = await run(groups.leaveGroup, { params: { groupId: GROUP }, user: { id: MEMBER } });
    expect(thrown).toBeNull();
    expect(sockets[0].leave).toHaveBeenCalled();
    expect(sockets[2].leave).not.toHaveBeenCalled();
  });

  it('deleting the group empties the room and tells open tabs', async () => {
    models.GroupMember.findOne.mockResolvedValueOnce({ role: 'owner' });
    models.Group.findByPk.mockResolvedValueOnce({ destroy: jest.fn().mockResolvedValue() });
    const req = { params: { groupId: GROUP }, user: { id: OWNER }, app: { get: () => require('../../utils/socket').getIO() } };
    const { thrown } = await run(groups.deleteGroup, req);
    expect(thrown).toBeNull();
    sockets.forEach((s) => expect(s.leave).toHaveBeenCalledWith(`group_${GROUP}`));
    expect(emitted).toEqual([['group-deleted', { groupId: GROUP }]]);
  });

  it('a socket failure never breaks the REST response', async () => {
    setIO({ in: () => { throw new Error('adapter down'); }, to: jest.fn() });
    models.GroupMember.findOne.mockResolvedValueOnce({ role: 'member', destroy: jest.fn().mockResolvedValue() });
    const { res, thrown } = await run(groups.leaveGroup, { params: { groupId: GROUP }, user: { id: MEMBER } });
    expect(thrown).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe('CHAT-19 invite by phone matches every stored form', () => {
  it('builds bare, 91, +91 and 0 forms from however the number was typed', () => {
    const forms = groups.phoneLookupForms('+91 98765-43210');
    expect(forms).toEqual(expect.arrayContaining(['9876543210', '919876543210', '+919876543210', '09876543210']));
  });

  it('queries User.phone with the whole variant set', async () => {
    models.GroupMember.findOne.mockResolvedValue({ role: 'owner' });
    models.GroupMember.count.mockResolvedValue(2);
    models.User.findOne.mockResolvedValue(null);
    await run(groups.addMember, { params: { groupId: GROUP }, body: { phone: '9876543210' }, user: { id: OWNER } });
    const where = models.User.findOne.mock.calls[0][0].where;
    const values = Object.getOwnPropertySymbols(where.phone).map((s) => where.phone[s]).flat();
    expect(values).toEqual(expect.arrayContaining(['9876543210', '919876543210', '+919876543210']));
  });
});
