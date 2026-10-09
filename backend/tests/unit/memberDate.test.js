/**
 * Membership dates in member email. The confirmation mail printed
 * `endDate.toLocaleDateString()`, which runs in the server's US locale:
 * a plan ending 7 January 2027 arrived as "1/7/2027" and members read it
 * as 1 July (2026-10-09, real member report).
 */
const { templates, memberDate } = require('../../utils/email');

describe('memberDate', () => {
  it('spells the month out, so the day and month cannot be swapped', () => {
    expect(memberDate(new Date('2027-01-07T04:44:47.915Z'))).toBe('7 January 2027');
  });

  it('uses India time, not the server clock', () => {
    // 20:00 UTC on the 7th is already the 8th in India.
    expect(memberDate('2027-01-07T20:00:00Z')).toBe('8 January 2027');
  });

  it('shows an already-formatted string (old queued job) as given', () => {
    expect(memberDate('1/7/2027')).toBe('1/7/2027');
    expect(memberDate(undefined)).toBe('');
  });
});

describe('subscription confirmation mail', () => {
  it('prints the end date unambiguously in the body, preheader and text part', () => {
    const { html, text } = templates.subscriptionConfirmation(
      'Ankita', 'premium_plus', new Date('2027-01-07T04:44:47.915Z'),
    );
    expect(html).toContain('7 January 2027');
    expect(text).toContain('valid until 7 January 2027');
    expect(html).not.toContain('1/7/2027');
  });
});
