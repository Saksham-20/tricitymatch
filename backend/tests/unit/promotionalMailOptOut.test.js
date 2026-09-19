'use strict';

/**
 * What an unsubscribe actually changes, at the two places mail leaves:
 *  - the provider call: promotional mail carries List-Unsubscribe headers
 *    (RFC 8058) and a footer link; mail about the member's own money or account
 *    carries neither, because it is not optional;
 *  - the weekly digest: skipped for a member who opted out, linked for the rest.
 */

const UNSUB = {
  pageUrl: 'https://tricitymatch.com/unsubscribe?u=U&t=T',
  oneClickUrl: 'https://tricitymatch.com/api/v1/email/unsubscribe?u=U&t=T',
};

describe('provider call', () => {
  // Asserted at the network seam (global.fetch), exactly as emailDryRun.test.js
  // does. An earlier draft mocked the `resend` module instead, and under a full
  // parallel run that mock was sometimes not picked up — the REAL SDK ran and
  // made a live request ("API key is invalid"). A unit test must not depend on
  // that, so the SDK stays real and only the wire is faked.
  let email;
  let fetchSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../config/env', () => ({
      isProduction: false,
      isDevelopment: true,
      email: {
        resend: { apiKey: 'test-key', isConfigured: () => true },
        from: 'noreply@tricitymatch.com', fromName: 'TricityMatch',
        replyTo: 'support@tricitymatch.com', support: 'support@tricitymatch.com',
        smtpConfigured: () => false, dryRun: false,
      },
      server: { frontendUrl: 'https://tricitymatch.com' },
    }));
    jest.doMock('../../middlewares/logger', () => ({
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_1' }),
      text: async () => '',
    });
    global.fetch = fetchSpy;
    email = require('../../utils/email');
  });

  afterEach(() => {
    delete global.fetch;
    jest.resetModules();
  });

  const sentBody = () => {
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    return JSON.parse(fetchSpy.mock.calls[0][1].body);
  };

  it.each([
    ['photo nudge', (e) => e.sendAddPhotoNudge('a@b.c', 'Aman', UNSUB)],
    ['checkout follow-up', (e) => e.sendCheckoutFollowUp('a@b.c', 'Aman', 'Premium', UNSUB)],
    ['win-back', (e) => e.sendWinBack('a@b.c', 'Aman', 3, UNSUB)],
    ['weekly digest', (e) => e.sendWeeklyDigest('a@b.c', 'Aman', 4, '', UNSUB)],
  ])('%s: one-click headers, footer link and a plain-text link', async (_label, fire) => {
    await fire(email);

    const sent = sentBody();
    expect(sent.headers).toEqual({
      'List-Unsubscribe': `<${UNSUB.oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(sent.html).toContain('Unsubscribe from reminder emails');
    expect(sent.html).toContain('u=U&amp;t=T'); // escaped in the attribute
    expect(sent.text).toContain(UNSUB.pageUrl);
  });

  it.each([
    ['payment failed', (e) => e.sendPaymentFailed('a@b.c', 'Aman', 'Premium', 1099)],
    ['renewal notice', (e) => e.sendRenewalReminder('a@b.c', 'Aman', 'Premium', '14 Oct 2026', 7)],
    ['expiry notice', (e) => e.sendMembershipExpired('a@b.c', 'Aman', 'Premium')],
    ['OTP', (e) => e.sendOtpEmail('a@b.c', '123456')],
    ['security alert', (e) => e.sendSecurityAlert('a@b.c', 'Aman', 'New login', 'A new device signed in')],
  ])('%s: never carries an opt-out — it is not optional', async (_label, fire) => {
    await fire(email);

    const sent = sentBody();
    expect(sent.headers).toBeUndefined();
    expect(sent.html).not.toContain('Unsubscribe');
  });

  it('a promotional mail sent without links (a caller that forgot) still delivers, just without the opt-out', async () => {
    await email.sendAddPhotoNudge('a@b.c', 'Aman');
    expect(sentBody().headers).toBeUndefined();
  });
});

describe('weekly digest job', () => {
  const setup = async (users) => {
    jest.resetModules();
    const sendWeeklyDigest = jest.fn().mockResolvedValue({ success: true });
    jest.doMock('../../utils/email', () => ({ sendWeeklyDigest }));
    jest.doMock('../../config/env', () => ({
      isProduction: false,
      auth: { jwtSecret: 'x'.repeat(40) },
      server: { frontendUrl: 'https://tricitymatch.com' },
      redis: { isConfigured: () => false },
    }));
    jest.doMock('../../middlewares/logger', () => ({
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    jest.doMock('../../models', () => ({
      User: { findAll: jest.fn().mockResolvedValue(users), update: jest.fn() },
      Profile: { count: jest.fn().mockResolvedValue(4) },
      Match: { findAll: jest.fn().mockResolvedValue([]) },
    }));
    const { setupCleanupProcessor } = require('../../utils/queue');
    const handlers = {};
    setupCleanupProcessor({ process: (name, fn) => { handlers[name] = fn; } });
    await handlers['send-weekly-digest']({});
    return sendWeeklyDigest;
  };

  const member = (id, lifecycleMail = null) => ({
    id, email: `${id}@example.com`, lifecycleMail, Profile: { gender: 'male', firstName: 'Aman' },
  });
  const U1 = '3f0c9a52-8d6e-4b1a-9c77-2a5d1e6f4b10';
  const U2 = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

  afterEach(() => jest.resetModules());

  it('mails members who have not opted out, with their own unsubscribe link', async () => {
    const send = await setup([member(U1)]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      `${U1}@example.com`, 'Aman', 4, '',
      expect.objectContaining({ pageUrl: expect.stringContaining(`/unsubscribe?u=${U1}&t=`) })
    );
  });

  it('skips a member who unsubscribed and still mails the others', async () => {
    const send = await setup([member(U1, { emailOptOut: '2026-09-01T00:00:00.000Z' }), member(U2)]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(`${U2}@example.com`);
  });
});
