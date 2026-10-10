'use strict';

/**
 * The SMS provider calls had no time limit, so a provider that accepted the
 * connection and never answered held the member's sign-up request (and a server
 * worker) open indefinitely. Now a send that has not answered in 10 seconds is
 * abandoned and reported exactly like any other failed send: the code is thrown
 * away and the member gets a 503 asking them to try again.
 */

const { EventEmitter } = require('events');

jest.mock('https', () => ({ request: jest.fn() }));
jest.mock('../../config/env', () => ({
  sms: {
    provider: 'msg91', apiKey: 'test-authkey', msg91TemplateId: 'tmpl', senderId: 'TRISHD',
    dailyBudget: 0, bypassCodes: [], isConfigured: () => true,
  },
  server: { isProduction: false },
  isDevelopment: false,
  env: 'test',
}));
jest.mock('../../utils/otpStore', () => ({
  spendSend: jest.fn(async () => {}),
  issue: jest.fn(async () => '4821'),
  discard: jest.fn(async () => {}),
  verify: jest.fn(),
}));
jest.mock('../../utils/cache', () => ({ incr: jest.fn(async () => 1) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const https = require('https');
const config = require('../../config/env');
const otpStore = require('../../utils/otpStore');
const smsService = require('../../utils/smsService');

// A request the provider accepts and never answers. Destroying it raises
// "socket hang up", as Node does, which must not turn into a second outcome.
const hangingRequest = () => {
  const req = new EventEmitter();
  req.write = jest.fn();
  req.end = jest.fn();
  req.destroy = jest.fn(() => { req.emit('error', new Error('socket hang up')); req.emit('close'); });
  return req;
};

// A request the provider answers straight away with `payload`.
const answeringRequest = (payload, onResponse) => {
  const req = new EventEmitter();
  req.write = jest.fn();
  req.end = jest.fn(() => {
    const res = new EventEmitter();
    onResponse(res);
    res.emit('data', JSON.stringify(payload));
    res.emit('end');
    req.emit('close');
  });
  req.destroy = jest.fn();
  return req;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  config.sms.provider = 'msg91';
});

describe.each([['msg91'], ['fast2sms']])('%s send that never answers', (provider) => {
  it('gives up after 10 seconds as a failed send: 503, code discarded, request dropped', async () => {
    config.sms.provider = provider;
    const req = hangingRequest();
    https.request.mockReturnValue(req);

    const sending = smsService.sendOtp('9876543210');
    const outcome = sending.then(() => 'sent', (err) => err);

    await jest.advanceTimersByTimeAsync(9_999);
    expect(req.destroy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(2);
    const err = await outcome;
    expect(err).toMatchObject({ statusCode: 503 });
    expect(req.destroy).toHaveBeenCalledTimes(1);
    expect(otpStore.discard).toHaveBeenCalledWith('phone', '919876543210');
  });
});

it('a provider that answers in time is not cut off, and leaves no timer behind', async () => {
  const req = answeringRequest({ type: 'success' }, (res) => https.request.mock.calls[0][1](res));
  https.request.mockReturnValue(req);

  await expect(smsService.sendOtp('9876543210')).resolves.toMatchObject({ success: true, isDev: false });
  expect(jest.getTimerCount()).toBe(0);
  expect(req.destroy).not.toHaveBeenCalled();
  expect(otpStore.discard).not.toHaveBeenCalled();
});
