/**
 * Ops alert mail.
 *
 * utils/alerts queued job `alert` on the email queue, and no processor handled
 * that name, so Bull failed every one: an email or SMS budget running out told
 * nobody. The processor now exists, and because alert mail shares the provider
 * quota with sign-up codes it is capped twice: the same alert at most once an
 * hour, at most ALERT_EMAIL_DAILY_CAP alert mails a day.
 */

jest.mock('../../config/env', () => ({
  monitoring: { alertEmails: ' ops@tricitymatch.com , alerts@tricitymatch.com ' },
}));
jest.mock('../../config/database', () => ({}));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../utils/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../utils/queue', () => ({ addJob: jest.fn() }));

const mockCounts = new Map();
jest.mock('../../utils/cache', () => ({
  incr: jest.fn(async (key) => {
    const n = (mockCounts.get(key) || 0) + 1;
    mockCounts.set(key, n);
    return n;
  }),
}));

const { sendEmail } = require('../../utils/email');
const { addJob } = require('../../utils/queue');
const { log } = require('../../middlewares/logger');
const alerts = require('../../utils/alerts');

const { deliverAlertEmail, ALERT_EMAIL_DAILY_CAP, SEVERITY, ALERT_TYPES } = alerts;

const budgetAlert = (used, source = 'Account email') => ({
  id: `${ALERT_TYPES.RATE_LIMIT_EXCEEDED}-${SEVERITY.CRITICAL}`,
  type: ALERT_TYPES.RATE_LIMIT_EXCEEDED,
  severity: SEVERITY.CRITICAL,
  message: `${source} daily budget ${used}/500`,
  data: { used, budget: 500 },
  timestamp: '2026-10-11T05:00:00.000Z',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCounts.clear();
  sendEmail.mockResolvedValue({ success: true });
  alerts.clearAlerts();
});

describe('deliverAlertEmail', () => {
  test('mails the configured recipients, escaped, with the severity in the subject', async () => {
    const alert = { ...budgetAlert(501), data: { note: '<script>x</script>' } };
    expect(await deliverAlertEmail(alert)).toEqual({ sent: true });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toEqual(['ops@tricitymatch.com', 'alerts@tricitymatch.com']);
    expect(mail.subject).toBe('[TricityMatch CRITICAL] Account email daily budget 501/500');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.text).toContain('Account email daily budget 501/500');
  });

  test('recipients carried on the job win over the configured ones', async () => {
    await deliverAlertEmail(budgetAlert(501), ['owner@example.com']);
    expect(sendEmail.mock.calls[0][0].to).toEqual(['owner@example.com']);
  });

  test('the same alert with a moving counter mails once an hour, not once per count', async () => {
    expect(await deliverAlertEmail(budgetAlert(501))).toEqual({ sent: true });
    expect(await deliverAlertEmail(budgetAlert(502))).toEqual({ sent: false, reason: 'cooldown' });
    expect(await deliverAlertEmail(budgetAlert(640))).toEqual({ sent: false, reason: 'cooldown' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('two sources that share an alert type are told apart by their title', async () => {
    expect(await deliverAlertEmail(budgetAlert(501, 'Account email'))).toEqual({ sent: true });
    expect(await deliverAlertEmail(budgetAlert(201, 'SMS'))).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test(`no more than ${ALERT_EMAIL_DAILY_CAP} alert mails a day, however many distinct alerts fire`, async () => {
    const results = [];
    for (let i = 0; i < ALERT_EMAIL_DAILY_CAP + 3; i++) {
      results.push(await deliverAlertEmail({ ...budgetAlert(1), type: `type_${i}`, message: `Distinct alert ${String.fromCharCode(97 + i)}` }));
    }
    expect(sendEmail).toHaveBeenCalledTimes(ALERT_EMAIL_DAILY_CAP);
    expect(results.slice(ALERT_EMAIL_DAILY_CAP)).toEqual(Array(3).fill({ sent: false, reason: 'daily_cap' }));
  });

  test('with no recipients configured nothing is sent and the gap is logged', async () => {
    const config = require('../../config/env');
    const before = config.monitoring.alertEmails;
    config.monitoring.alertEmails = '';
    try {
      expect(await deliverAlertEmail(budgetAlert(501))).toEqual({ sent: false, reason: 'no_recipients' });
    } finally {
      config.monitoring.alertEmails = before;
    }
    expect(sendEmail).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith('Alert email skipped: ALERT_EMAILS is empty', expect.any(Object));
  });

  test('a refused send is reported, not thrown', async () => {
    sendEmail.mockResolvedValue({ success: false, error: 'quota' });
    expect(await deliverAlertEmail(budgetAlert(501))).toEqual({ sent: false, reason: 'send_failed' });
  });
});

describe('wiring', () => {
  test('a critical alert is queued as job `alert` with the configured recipients', async () => {
    await alerts.triggerAlert(ALERT_TYPES.RATE_LIMIT_EXCEEDED, SEVERITY.CRITICAL, 'SMS daily budget 201/200', {});
    expect(addJob).toHaveBeenCalledWith('email', 'alert', expect.objectContaining({
      recipients: ['ops@tricitymatch.com', 'alerts@tricitymatch.com'],
    }));
  });

  test('a warning is logged only, not mailed', async () => {
    await alerts.triggerAlert(ALERT_TYPES.HIGH_LATENCY, SEVERITY.WARNING, 'p95 2400ms', {});
    expect(addJob).not.toHaveBeenCalled();
  });

  test('the email queue has a processor for `alert` that delivers through deliverAlertEmail', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../utils/alerts', () => ({ deliverAlertEmail: jest.fn(async () => ({ sent: true })) }));
      const { setupEmailProcessor } = jest.requireActual('../../utils/queue');
      const handlers = {};
      setupEmailProcessor({ process: (name, fn) => { handlers[name] = fn; } });
      expect(typeof handlers.alert).toBe('function');
      const { deliverAlertEmail: mocked } = require('../../utils/alerts');
      const alert = budgetAlert(501);
      const out = await handlers.alert({ data: { alert, recipients: ['ops@tricitymatch.com'] } });
      expect(mocked).toHaveBeenCalledWith(alert, ['ops@tricitymatch.com']);
      expect(out).toEqual({ sent: true });
    });
  });
});
