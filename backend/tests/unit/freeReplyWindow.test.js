/**
 * D1 free-reply window — grant matrix + window-state derivation.
 *
 * Two load-bearing rules:
 * 1. ES2 (grant direction): a grant authorizes its FREE side only. The lookup
 *    is strictly `freeUserId = userId` — a lapsed-premium member must never
 *    keep chatting through grants they created. The lapsed-premium test below
 *    is the regression guard for that loophole.
 * 2. Grant = READ forever, SEND requires `active`. hasChatAccess therefore
 *    returns allowed:true for an exhausted grant (the thread stays readable);
 *    the send path re-derives state under a row lock and 403s.
 */

jest.mock('../../config/env', () => ({
  features: { freeChatForMutuals: false, freeReplyWindow: false },
  founding: { isOpen: jest.fn(() => false) },
  isProduction: false,
  isDevelopment: true,
}));

jest.mock('../../models', () => ({
  Subscription: { findOne: jest.fn() },
  Match: { findOne: jest.fn() },
  ChatGrant: { findOne: jest.fn(), count: jest.fn() },
}));

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
}));

const config = require('../../config/env');
const { Subscription, Match, ChatGrant } = require('../../models');
const { hasChatAccess, grantWindowState } = require('../../utils/entitlements');
const { FREE_REPLY_MAX_MESSAGES, FREE_REPLY_WINDOW_MS } = require('../../constants/chat');

const PAID_ROW = { id: 'sub-1', planType: 'basic_premium', status: 'active', endDate: null };
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  config.features.freeChatForMutuals = false;
  config.features.freeReplyWindow = true;
  Subscription.findOne.mockResolvedValue(null);
  Match.findOne.mockResolvedValue(null);
  ChatGrant.findOne.mockResolvedValue(null);
  ChatGrant.count.mockResolvedValue(0);
});

describe('grantWindowState', () => {
  it('fresh grant (no reply yet) is active with full budget and no expiry', () => {
    const s = grantWindowState({ messagesUsed: 0, firstReplyAt: null });
    expect(s).toMatchObject({
      messagesUsed: 0,
      messagesRemaining: FREE_REPLY_MAX_MESSAGES,
      firstReplyAt: null,
      expiresAt: null,
      active: true,
    });
  });

  it('window clock starts at first reply: expiresAt = firstReplyAt + 48h', () => {
    const firstReplyAt = new Date(Date.now() - HOUR);
    const s = grantWindowState({ messagesUsed: 2, firstReplyAt });
    expect(s.active).toBe(true);
    expect(s.messagesRemaining).toBe(FREE_REPLY_MAX_MESSAGES - 2);
    expect(s.expiresAt.getTime()).toBe(firstReplyAt.getTime() + FREE_REPLY_WINDOW_MS);
  });

  it('exhausted budget deactivates even inside the window', () => {
    const s = grantWindowState({ messagesUsed: FREE_REPLY_MAX_MESSAGES, firstReplyAt: new Date() });
    expect(s.active).toBe(false);
    expect(s.messagesRemaining).toBe(0);
  });

  it('expired window deactivates even with budget left (49h after first reply)', () => {
    const s = grantWindowState({ messagesUsed: 1, firstReplyAt: new Date(Date.now() - 49 * HOUR) });
    expect(s.active).toBe(false);
    expect(s.messagesRemaining).toBe(FREE_REPLY_MAX_MESSAGES - 1);
  });
});

describe('hasChatAccess grant branch', () => {
  it('paid member short-circuits before any grant lookup', async () => {
    Subscription.findOne.mockResolvedValue(PAID_ROW);
    const access = await hasChatAccess('u1', 'u2');
    expect(access).toMatchObject({ allowed: true, reason: 'paid' });
    expect(ChatGrant.findOne).not.toHaveBeenCalled();
  });

  it('flag OFF: grants are never reached — free member stays 403', async () => {
    config.features.freeReplyWindow = false;
    ChatGrant.findOne.mockResolvedValue({ messagesUsed: 0, firstReplyAt: null });
    const access = await hasChatAccess('free-1', 'prem-1');
    expect(access).toMatchObject({ allowed: false, reason: 'premium_required' });
    expect(ChatGrant.findOne).not.toHaveBeenCalled();
  });

  it('grant on the pair admits the free member with replyWindow state', async () => {
    ChatGrant.findOne.mockResolvedValue({ messagesUsed: 1, firstReplyAt: null });
    const access = await hasChatAccess('free-1', 'prem-1');
    expect(access).toMatchObject({ allowed: true, reason: 'free_reply_window' });
    expect(access.replyWindow).toMatchObject({ messagesUsed: 1, active: true });
    expect(ChatGrant.findOne).toHaveBeenCalledWith({
      where: { freeUserId: 'free-1', premiumUserId: 'prem-1' },
    });
  });

  it('exhausted grant STILL opens the thread (read forever) — send gates elsewhere', async () => {
    ChatGrant.findOne.mockResolvedValue({
      messagesUsed: FREE_REPLY_MAX_MESSAGES,
      firstReplyAt: new Date(Date.now() - HOUR),
    });
    const access = await hasChatAccess('free-1', 'prem-1');
    expect(access.allowed).toBe(true);
    expect(access.replyWindow.active).toBe(false);
  });

  it('conversations listing (no otherUserId): any held grant admits', async () => {
    ChatGrant.count.mockResolvedValue(1);
    const access = await hasChatAccess('free-1');
    expect(access).toMatchObject({ allowed: true, reason: 'free_reply_window', replyWindow: null });
    expect(ChatGrant.count).toHaveBeenCalledWith({ where: { freeUserId: 'free-1' } });
  });

  it('conversations listing with zero grants keeps the existing 403', async () => {
    ChatGrant.count.mockResolvedValue(0);
    const access = await hasChatAccess('free-1');
    expect(access).toMatchObject({ allowed: false, reason: 'premium_required' });
  });

  it('ES2: lapsed premium gets NO access through grants they created', async () => {
    // Their sub expired (getActiveSubscription → null). The only grant row has
    // them as premiumUserId; the freeUserId-keyed lookup must not find it.
    ChatGrant.findOne.mockResolvedValue(null);
    const access = await hasChatAccess('lapsed-prem', 'free-1');
    expect(access).toMatchObject({ allowed: false, reason: 'premium_required' });
    expect(ChatGrant.findOne).toHaveBeenCalledWith({
      where: { freeUserId: 'lapsed-prem', premiumUserId: 'free-1' },
    });
  });

  it('freeChatForMutuals takes precedence for mutual pairs (grants moot)', async () => {
    config.features.freeChatForMutuals = true;
    Match.findOne.mockResolvedValue({ id: 'm1' });
    const access = await hasChatAccess('free-1', 'free-2');
    expect(access).toMatchObject({ allowed: true, reason: 'free_chat_mutual' });
    expect(ChatGrant.findOne).not.toHaveBeenCalled();
  });

  it('DB error in the grant lookup fails CLOSED', async () => {
    ChatGrant.findOne.mockRejectedValue(new Error('conn refused'));
    const access = await hasChatAccess('free-1', 'prem-1');
    expect(access.allowed).toBe(false);
  });
});
