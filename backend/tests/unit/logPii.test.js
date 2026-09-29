/**
 * P1-12: log lines carry no contact details. Contact values are replaced by a
 * short stable hash so lines about the same address still correlate.
 */

jest.mock('../../config/env', () => ({ env: 'test', isProduction: false, isDevelopment: false, logging: {} }));

const { log } = require('../../middlewares/logger');

// Spied per test: the jest config restores mocks between tests.
let spies = [];

const lastLine = () => {
  for (const s of spies) {
    if (s.mock.calls.length) return JSON.parse(s.mock.calls[s.mock.calls.length - 1][0]);
  }
  return null;
};
beforeEach(() => {
  spies = ['log', 'info', 'warn', 'error'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => spies.forEach((s) => s.mockRestore()));

describe('log PII', () => {
  it('hashes contact-named meta keys', () => {
    log.error('Email send failed', { to: 'asha@example.com', subject: 'Hi', phone: '9814012345' });
    const line = lastLine();
    expect(JSON.stringify(line)).not.toContain('asha@example.com');
    expect(JSON.stringify(line)).not.toContain('9814012345');
    expect(line.to).toMatch(/^email#[0-9a-f]{8}$/);
    expect(line.phone).toMatch(/^contact#[0-9a-f]{8}$/);
    expect(line.subject).toBe('Hi');
  });

  it('the same address always hashes the same, case-insensitively', () => {
    log.info('a', { email: 'Asha@Example.com' });
    const first = lastLine().email;
    spies.forEach((s) => s.mockClear());
    log.info('b', { email: 'asha@example.com' });
    expect(lastLine().email).toBe(first);
  });

  it('scrubs addresses and numbers written into the message text', () => {
    log.info('Sent OTP to asha@example.com and +91 98140 12345, also 9814012345');
    const line = lastLine();
    expect(line.message).not.toMatch(/asha@example\.com/);
    expect(line.message).not.toMatch(/98140/);
    expect(line.message).toMatch(/email#[0-9a-f]{8}/);
    expect(line.message).toMatch(/phone#[0-9a-f]{8}/);
  });

  it('scrubs nested and string values, and leaves ids and ordinary numbers alone', () => {
    log.warn('failed', { detail: { note: 'contact bob@x.io please' }, userId: '9a6a16e6-d4a9-49f0-a962-e2a0ea27fef4', count: 12, orderId: 'order_Nabc123456' });
    const line = lastLine();
    expect(line.detail.note).toMatch(/email#/);
    expect(line.userId).toBe('9a6a16e6-d4a9-49f0-a962-e2a0ea27fef4');
    expect(line.count).toBe(12);
    expect(line.orderId).toBe('order_Nabc123456');
  });

  it('still redacts secrets by key', () => {
    log.info('x', { password: 'hunter2', accessToken: 'abc' });
    const line = lastLine();
    expect(line.password).toBe('[REDACTED]');
    expect(line.accessToken).toBe('[REDACTED]');
  });
});
