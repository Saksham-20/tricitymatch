jest.mock('../../middlewares/logger', () => {
  const actual = jest.requireActual('../../middlewares/logger');
  return { ...actual };
});

const { templates } = require('../../utils/email');

describe('partnerWelcome email', () => {
  it('addresses the partner, points at sign-in and the first steps', () => {
    const mail = templates.partnerWelcome('Priya');
    expect(mail.subject).toMatch(/partner account is ready/i);
    expect(mail.html).toContain('Hi Priya,');
    expect(mail.html).toMatch(/\/login"/);
    expect(mail.html).toMatch(/Partner Guide/);
    expect(mail.html).toMatch(/payout details/i);
    expect(mail.html).toMatch(/referral code/i);
    expect(mail.text).toMatch(/\/login/);
  });

  it('escapes the name — it is typed by an admin, not trusted', () => {
    const mail = templates.partnerWelcome('<script>alert(1)</script>');
    expect(mail.html).not.toContain('<script>alert(1)</script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('never mentions a password value and tells the partner to change theirs', () => {
    const mail = templates.partnerWelcome('Priya');
    expect(mail.html).toMatch(/change it/i);
    expect(mail.html).not.toMatch(/password:\s*\S/i);
  });

  it('falls back gracefully without a name', () => {
    expect(templates.partnerWelcome('').html).toContain('Hi there,');
  });
});
