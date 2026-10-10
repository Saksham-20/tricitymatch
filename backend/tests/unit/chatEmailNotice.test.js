/**
 * The "you have a new message" email.
 *
 * It used to go out for EVERY chat message: a lively thread mailed the other
 * member a dozen times in minutes, to unproven addresses too, all drawn from
 * the same provider quota as sign-up codes and password resets. Now: at most
 * one per sender → receiver pair per hour, and none when the receiver is
 * online, has no proven address, unsubscribed, or muted message notices.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), security: jest.fn() },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
}));
jest.mock('../../models', () => ({
  Message: {}, Match: {}, ChatGrant: {},
  User: { findByPk: jest.fn() },
  Profile: { findOne: jest.fn() },
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn(), query: jest.fn(), fn: jest.fn(), col: jest.fn() }));
jest.mock('../../utils/emailService', () => ({ sendMessageNotification: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));

const mockRooms = new Map();
jest.mock('../../utils/socket', () => ({
  getIO: jest.fn(() => ({ sockets: { adapter: { rooms: mockRooms } } })),
}));

const mockClaims = new Map();
jest.mock('../../utils/cache', () => ({
  ...jest.requireActual('../../utils/cache'),
  incr: jest.fn(async (key) => {
    const n = (mockClaims.get(key) || 0) + 1;
    mockClaims.set(key, n);
    return n;
  }),
}));

const { User, Profile } = require('../../models');
const { sendMessageNotification } = require('../../utils/emailService');
const { incr } = require('../../utils/cache');
const { sendReceiverEmailNotice } = require('../../controllers/chatController');

const SENDER = '11111111-1111-4111-8111-111111111111';
const RECEIVER = '22222222-2222-4222-8222-222222222222';
const OTHER_SENDER = '33333333-3333-4333-8333-333333333333';

const receiver = (over = {}) => ({
  id: RECEIVER,
  email: 'riya@example.com',
  emailVerified: true,
  status: 'active',
  lifecycleMail: null,
  notificationPrefs: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRooms.clear();
  mockClaims.clear();
  User.findByPk.mockResolvedValue(receiver());
  Profile.findOne.mockResolvedValue({ firstName: 'Aman', lastName: 'Singh' });
  sendMessageNotification.mockResolvedValue({ success: true });
});

test('an offline member with a proven address gets one mail naming the sender', async () => {
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('sent');
  expect(sendMessageNotification).toHaveBeenCalledTimes(1);
  expect(sendMessageNotification).toHaveBeenCalledWith('riya@example.com', 'Aman Singh', 'You have a new message');
  expect(incr).toHaveBeenCalledWith(`chat_email:${RECEIVER}:${SENDER}`, 3600);
});

test('more messages from the same sender within the hour send nothing more', async () => {
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('sent');
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('throttled');
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('throttled');
  expect(sendMessageNotification).toHaveBeenCalledTimes(1);
});

test('the hourly limit is per pair: a different sender still gets through', async () => {
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('sent');
  expect(await sendReceiverEmailNotice(OTHER_SENDER, RECEIVER)).toBe('sent');
  expect(sendMessageNotification).toHaveBeenCalledTimes(2);
});

test('a member who is online already has the message: no mail, no lookup', async () => {
  mockRooms.set(`user_${RECEIVER}`, new Set(['socket-1']));
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('online');
  expect(User.findByPk).not.toHaveBeenCalled();
  expect(sendMessageNotification).not.toHaveBeenCalled();
});

test('an empty personal room counts as offline', async () => {
  mockRooms.set(`user_${RECEIVER}`, new Set());
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe('sent');
});

test.each([
  ['an address nobody proved', { emailVerified: false }, 'unverified'],
  ['a member who used the unsubscribe link', { lifecycleMail: { emailOptOut: '2026-09-01T00:00:00.000Z' } }, 'opted_out'],
  ['a member who muted message notices', { notificationPrefs: { messages: false } }, 'muted'],
  ['an account that is not active', { status: 'suspended' }, 'no_address'],
  ['a member with no email on file', { email: null }, 'no_address'],
])('%s gets no mail', async (_label, over, reason) => {
  User.findByPk.mockResolvedValue(receiver(over));
  expect(await sendReceiverEmailNotice(SENDER, RECEIVER)).toBe(reason);
  expect(sendMessageNotification).not.toHaveBeenCalled();
  // A skipped member does not burn the hour: the claim is taken last.
  expect(incr).not.toHaveBeenCalled();
});
