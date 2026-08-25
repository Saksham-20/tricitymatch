'use strict';

/**
 * Dev shares production's Resend API key, so any batch job run locally spends
 * the live daily quota — and once that quota is gone, production OTP and
 * password-reset mail stops for everyone until it resets. That happened once
 * (25 Aug 2026, a photo-nudge run that reached 5,000 seeded loadtest accounts).
 *
 * Two guarantees make it non-repeatable, and both are pinned here: a dry run
 * sends nothing while still reporting success to its caller, and a real run
 * still sends.
 */

const baseConfig = (overrides = {}) => ({
  isProduction: false,
  isDevelopment: true,
  email: {
    resend: { apiKey: 'test-key', isConfigured: () => true },
    host: 'smtp.test', port: 587, secure: false, user: '', password: '',
    from: 'noreply@tricitymatch.com',
    fromName: 'TricityMatch',
    replyTo: 'support@tricitymatch.com',
    smtpConfigured: () => false,
    dryRun: true,
    ...overrides,
  },
  server: { frontendUrl: 'https://tricitymatch.com' },
  support: { email: 'support@tricitymatch.com' },
});

const loadEmail = (overrides) => {
  jest.resetModules();
  jest.doMock('../../config/env', () => baseConfig(overrides));
  const fetchSpy = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'msg_1' }),
    text: async () => '',
  });
  global.fetch = fetchSpy;
  return { email: require('../../utils/email'), fetchSpy };
};

afterAll(() => {
  jest.resetModules();
  delete global.fetch;
});

describe('email dry run', () => {
  it('sends nothing over the network when dry run is on', async () => {
    const { email, fetchSpy } = loadEmail({ dryRun: true });
    const result = await email.sendEmail('someone@example.com', 'addPhotoNudge', { name: 'Aman' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
  });

  it('still reports success, so callers exercise their real paths', async () => {
    // Lifecycle jobs only mark a mail as sent when delivery succeeded. If a dry
    // run reported failure, every local run would look like a broken mailer.
    const { email } = loadEmail({ dryRun: true });
    const result = await email.sendEmail('someone@example.com', 'welcome', { name: 'Aman' });
    expect(result.success).toBe(true);
  });

  it('actually sends when dry run is off', async () => {
    const { email, fetchSpy } = loadEmail({ dryRun: false });
    await email.sendEmail('someone@example.com', 'welcome', { name: 'Aman' });
    expect(fetchSpy).toHaveBeenCalled();
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('resend');
  });
});
