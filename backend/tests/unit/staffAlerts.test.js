'use strict';

/**
 * Safety mail (urgent reports, appeals, chat scam patterns) used to go to
 * SUPPORT_EMAIL only: a receiving address nobody reads. It now also goes to
 * ALERT_EMAILS, the list the people on call watch.
 */

const mockConfig = {
  email: { support: 'Support@TricityMatch.com' },
  monitoring: { alertEmails: '' },
};
jest.mock('../../config/env', () => mockConfig);

const { staffAlertRecipients } = require('../../utils/staffAlerts');

afterEach(() => {
  mockConfig.email.support = 'Support@TricityMatch.com';
  mockConfig.monitoring.alertEmails = '';
});

describe('staffAlertRecipients', () => {
  it('is the support address alone when no alert list is set', () => {
    expect(staffAlertRecipients()).toEqual(['support@tricitymatch.com']);
  });

  it('adds every alert address, trimmed, lower-cased and once each', () => {
    mockConfig.monitoring.alertEmails = ' owner@example.com , Ops@Example.com,ops@example.com, SUPPORT@tricitymatch.com ';
    expect(staffAlertRecipients()).toEqual(['support@tricitymatch.com', 'owner@example.com', 'ops@example.com']);
  });

  it('drops blanks and entries that are not addresses, which would make the provider refuse the whole mail', () => {
    mockConfig.monitoring.alertEmails = ',, ,owner@example.com,not-an-address,a@b,@example.com,two words@example.com';
    expect(staffAlertRecipients()).toEqual(['support@tricitymatch.com', 'owner@example.com']);
  });

  it('still reaches the alert list when the support address is unset', () => {
    mockConfig.email.support = '';
    mockConfig.monitoring.alertEmails = 'owner@example.com';
    expect(staffAlertRecipients()).toEqual(['owner@example.com']);
  });

  it('copes with a config that has no monitoring block at all', () => {
    const saved = mockConfig.monitoring;
    delete mockConfig.monitoring;
    try {
      expect(staffAlertRecipients()).toEqual(['support@tricitymatch.com']);
    } finally {
      mockConfig.monitoring = saved;
    }
  });
});
