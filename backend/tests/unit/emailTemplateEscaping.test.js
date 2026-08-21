/**
 * Outbound-email HTML escaping (deep security audit 2026-08-21, R2 XSS-2).
 *
 * Every branded template interpolates values into an HTML document that is then
 * delivered to somebody else's inbox. Several of those values are supplied by a
 * member: their own name, a matched member's name, an admin's free-text
 * rejection reason.
 *
 * This was not exploitable at the time it was found — signupValidation and
 * updateProfileValidation both restrict firstName to /^[a-zA-Z\s'-]+$/, so a
 * tag could not be stored through either path. But that single regex was the
 * ONLY control standing between member input and outbound HTML mail, and the
 * Google sign-in path writes `given_name` straight off the ID token without
 * ever running it. A one-control dependency on a template that reaches other
 * people's inboxes is not somewhere to rely on validation alone.
 *
 * These tests pin the escaping so a future template cannot quietly drop it.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { templates } = require('../../utils/email');

const PAYLOAD = '<img src=x onerror="alert(1)">';
const ESCAPED = '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;';

// The escaped form still contains the literal text `onerror=`, which is inert.
// What must never appear is an actual tag or an attribute that a mail client
// could parse: `<img` opening a element, or onerror bound to a real quoted value.
const expectNoRawTag = (html) => {
  expect(html).not.toContain('<img');
  expect(html).not.toContain('onerror="alert');
};

describe('member-supplied names are escaped in email HTML', () => {
  it.each([
    ['welcome', () => templates.welcome(PAYLOAD)],
    ['passwordReset', () => templates.passwordReset(PAYLOAD, 'https://example.test/r')],
    ['verificationApproved', () => templates.verificationApproved(PAYLOAD)],
    ['weeklyDigest', () => templates.weeklyDigest(PAYLOAD, 4, '')],
  ])('%s', (_name, build) => {
    const { html } = build();
    expect(html).toContain(ESCAPED);
    expectNoRawTag(html);
  });
});

describe('a second member’s name is escaped', () => {
  it('matchNotification escapes matchName in both the preheader and the body', () => {
    const { html } = templates.matchNotification('Asha', PAYLOAD);
    expectNoRawTag(html);
    // Appears twice: preheader and the <strong> in the body.
    expect(html.split(ESCAPED).length - 1).toBeGreaterThanOrEqual(2);
  });
});

describe('admin free text is escaped', () => {
  it('verificationRejected escapes the reason panel', () => {
    const { html } = templates.verificationRejected('Asha', PAYLOAD);
    expect(html).toContain(ESCAPED);
    expectNoRawTag(html);
  });
});

describe('security alert fields are escaped', () => {
  it('escapes title, detail and when', () => {
    const { html } = templates.securityAlert('Asha', PAYLOAD, PAYLOAD, PAYLOAD);
    expectNoRawTag(html);
    expect(html.split(ESCAPED).length - 1).toBeGreaterThanOrEqual(3);
  });
});

describe('subscription confirmation fields are escaped', () => {
  it('escapes the expiry string', () => {
    const { html } = templates.subscriptionConfirmation('Asha', 'vip', PAYLOAD);
    expectNoRawTag(html);
    expect(html).toContain(ESCAPED);
  });
});

describe('support reply escaping still holds', () => {
  it('escapes both the reply and the quoted original', () => {
    const { html } = templates.supportReply('Asha', PAYLOAD, PAYLOAD);
    expectNoRawTag(html);
  });
});
