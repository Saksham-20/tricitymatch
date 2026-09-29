/**
 * Block enforcement across contact channels (platform audit 2026-09-29, P0-3).
 *
 * `blockUser` used to insert a Block row and nothing else. Only new likes,
 * search and profile view honoured it, so a member who blocked someone they
 * were ALREADY matched with stayed reachable through chat, voice notes,
 * reactions, calls and their live socket room, and the blocked person kept
 * appearing in the conversation list. These tests pin the barrier on every
 * channel and the cleanup the block action itself now performs.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), security: jest.fn() },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
}));

jest.mock('../../models', () => ({
  Block: { findOne: jest.fn(), findAll: jest.fn(), findOrCreate: jest.fn() },
  Match: { findOne: jest.fn(), findAll: jest.fn(), count: jest.fn(), update: jest.fn() },
  Message: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  ChatGrant: { findAll: jest.fn(), destroy: jest.fn() },
  CallSession: { findOne: jest.fn(), create: jest.fn(), update: jest.fn() },
  User: { findByPk: jest.fn() },
  Profile: { findOne: jest.fn() },
  Report: {},
  AstrologerBooking: { findOne: jest.fn() },
}));

jest.mock('../../config/database', () => ({
  transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
  query: jest.fn(),
  fn: jest.fn(),
  col: jest.fn(),
}));

jest.mock('../../utils/emailService', () => ({ sendMessageNotification: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/agoraToken', () => ({ generateRtcToken: jest.fn(() => null) }));

const mockSocketsLeave = jest.fn();
const mockIn = jest.fn(() => ({ socketsLeave: mockSocketsLeave }));
jest.mock('../../utils/socket', () => ({ getIO: jest.fn(() => ({ in: mockIn })) }));

const models = require('../../models');
const chat = require('../../controllers/chatController');
const calls = require('../../controllers/callController');
const blocks = require('../../controllers/blockReportController');

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

// asyncHandler does not return its promise; flush so the chain has settled.
const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  let thrown = null;
  handler(req, res, (err) => { thrown = err; });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, thrown };
};

const BLOCKED = { statusCode: 403, code: 'CONTACT_BLOCKED' };

beforeEach(() => {
  jest.clearAllMocks();
  // Default: the pair is mutual and NOT blocked; individual tests add a block.
  models.Block.findOne.mockResolvedValue(null);
  models.Block.findAll.mockResolvedValue([]);
  models.Match.findOne.mockResolvedValue({ id: 'm1' });
  models.User.findByPk.mockResolvedValue({ id: OTHER, status: 'active' });
});

describe('a block in either direction stops chat', () => {
  beforeEach(() => models.Block.findOne.mockResolvedValue({ id: 'b1' }));

  it('refuses to send a text message', async () => {
    const { thrown } = await run(chat.sendMessage, {
      body: { receiverId: OTHER, content: 'hello' },
      user: { id: ME },
      app: { get: () => null },
    });
    expect(thrown).toMatchObject(BLOCKED);
    expect(models.Message.create).not.toHaveBeenCalled();
  });

  it('refuses to read the thread', async () => {
    const { thrown } = await run(chat.getMessages, {
      params: { userId: OTHER },
      query: {},
      user: { id: ME },
    });
    expect(thrown).toMatchObject(BLOCKED);
    expect(models.Message.findAll).not.toHaveBeenCalled();
  });

  it('refuses to send a voice message', async () => {
    const { thrown } = await run(chat.sendVoiceMessage, {
      body: { receiverId: OTHER },
      user: { id: ME },
      file: { path: 'https://cdn.example/voice.m4a' },
      app: { get: () => null },
    });
    expect(thrown).toMatchObject(BLOCKED);
    expect(models.Message.create).not.toHaveBeenCalled();
  });

  it('refuses a reaction inside the blocked conversation', async () => {
    models.Message.findByPk.mockResolvedValue({
      id: 'msg1', senderId: OTHER, receiverId: ME, reactions: {}, changed: jest.fn(), save: jest.fn(),
    });
    const { thrown } = await run(chat.toggleReaction, {
      params: { messageId: 'msg1' },
      body: { emoji: '❤️' },
      user: { id: ME },
      app: { get: () => null },
    });
    expect(thrown).toMatchObject(BLOCKED);
  });

  it('gives the same answer whichever side placed the block', async () => {
    // findOne is queried with an OR over both directions, so a block placed BY
    // the other member is caught by the same single lookup.
    await run(chat.getMessages, { params: { userId: OTHER }, query: {}, user: { id: ME } });
    const { where } = models.Block.findOne.mock.calls[0][0];
    const clauses = where[Object.getOwnPropertySymbols(where)[0]];
    expect(clauses).toEqual([
      { blockerId: ME, blockedUserId: OTHER },
      { blockerId: OTHER, blockedUserId: ME },
    ]);
  });
});

describe('conversation list', () => {
  it('excludes blocked members from the query and from the count', async () => {
    models.Block.findAll.mockResolvedValue([{ blockerId: ME, blockedUserId: OTHER }]);
    models.Match.findAll.mockResolvedValue([]);
    models.Match.count.mockResolvedValue(0);

    await run(chat.getConversations, { user: { id: ME }, query: {} });

    const { where } = models.Match.findAll.mock.calls[0][0];
    const notIn = where.matchedUserId[Object.getOwnPropertySymbols(where.matchedUserId)[0]];
    expect(notIn).toEqual([OTHER]);
  });

  it('leaves the query unfiltered when nobody is blocked', async () => {
    models.Match.findAll.mockResolvedValue([]);
    await run(chat.getConversations, { user: { id: ME }, query: {} });
    const { where } = models.Match.findAll.mock.calls[0][0];
    expect(where.matchedUserId).toBeUndefined();
  });
});

describe('calls', () => {
  it('refuses to start a call across a block, before creating a session', async () => {
    models.Block.findOne.mockResolvedValue({ id: 'b1' });
    const { thrown } = await run(calls.initiateCall, {
      body: { calleeId: OTHER, type: 'voice' },
      user: { id: ME },
    });
    expect(thrown).toMatchObject(BLOCKED);
    expect(models.CallSession.create).not.toHaveBeenCalled();
  });

  it('refuses to accept a call that was ringing when the block was placed', async () => {
    models.CallSession.findByPk = jest.fn().mockResolvedValue({
      id: 'c1', callerId: OTHER, calleeId: ME, channelName: 'call_x', update: jest.fn(),
    });
    models.Block.findOne.mockResolvedValue({ id: 'b1' });
    const { thrown } = await run(calls.acceptCall, { params: { id: 'c1' }, user: { id: ME } });
    expect(thrown).toMatchObject(BLOCKED);
  });
});

describe('blockUser severs the standing relationship', () => {
  const blockReq = { user: { id: ME }, params: { userId: OTHER } };

  beforeEach(() => {
    models.Block.findOrCreate.mockResolvedValue([{ id: 'b1' }, true]);
    models.User.findByPk.mockResolvedValue({ id: OTHER });
  });

  it('clears the mutual flag, revokes chat grants and ends live calls', async () => {
    const { res } = await run(blocks.blockUser, blockReq);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(models.Match.update).toHaveBeenCalledWith(
      { isMutual: false },
      expect.objectContaining({ where: expect.anything() })
    );
    expect(models.ChatGrant.destroy).toHaveBeenCalled();
    expect(models.CallSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ended' }),
      expect.anything()
    );
  });

  it('evicts both members from the canonical pair room', async () => {
    await run(blocks.blockUser, blockReq);
    const room = [ME, OTHER].sort().join('_room_');
    expect(mockIn).toHaveBeenCalledWith(room);
    expect(mockSocketsLeave).toHaveBeenCalledWith(room);
  });

  it('repairs a pre-existing block on a repeat request instead of short-circuiting', async () => {
    models.Block.findOrCreate.mockResolvedValue([{ id: 'b1' }, false]);
    const { res } = await run(blocks.blockUser, blockReq);
    expect(models.Match.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'User was already blocked' }));
  });

  it('still reports success when the cleanup transaction fails (the Block row is the barrier)', async () => {
    models.Match.update.mockRejectedValueOnce(new Error('db hiccup'));
    const { res, thrown } = await run(blocks.blockUser, blockReq);
    expect(thrown).toBeNull();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
