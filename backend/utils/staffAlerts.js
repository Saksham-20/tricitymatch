'use strict';

/**
 * Who is told when something on the safety desk needs a person: an urgent
 * report, an appeal against a suspension, a member who keeps sending scam
 * signals in chat.
 *
 * These mails used to go to SUPPORT_EMAIL alone, which is a receiving address
 * rather than an inbox somebody watches. ALERT_EMAILS is where the people on
 * call actually look, so safety mail goes to both. Blanks and malformed entries
 * are dropped (one bad address makes the provider refuse the whole message), and
 * the same address listed twice, in any case, is mailed once.
 */

const config = require('../config/env');

const LOOKS_LIKE_ADDRESS = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const staffAlertRecipients = () => {
  const listed = [
    config.email?.support,
    ...String(config.monitoring?.alertEmails || '').split(','),
  ];
  const recipients = new Set();
  for (const entry of listed) {
    const address = String(entry || '').trim().toLowerCase();
    if (LOOKS_LIKE_ADDRESS.test(address)) recipients.add(address);
  }
  return [...recipients];
};

module.exports = { staffAlertRecipients };
