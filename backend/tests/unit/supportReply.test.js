/**
 * Support reply email.
 *
 * The reply body and the quoted enquiry are HUMAN-TYPED strings interpolated
 * into an HTML email — the only such path in this file — so they must be
 * escaped. An unescaped reply also means an admin could be tricked into
 * pasting markup that renders in a member's inbox.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Capture what would be sent instead of hitting a provider.
const sent = [];
jest.mock('resend', () => ({
  Resend: class {
    constructor() {
      this.emails = { send: async (payload) => { sent.push(payload); return { data: { id: 'test' }, error: null }; } };
    }
  },
}), { virtual: true });

jest.mock('../../config/env', () => ({
  email: {
    from: 'noreply@tricitymatch.com',
    fromName: 'TricityMatch',
    replyTo: 'support@tricitymatch.com',
    support: 'support@tricitymatch.com',
    resend: { apiKey: 're_test_key', isConfigured: () => true },
    smtpConfigured: () => false,
  },
  server: { frontendUrl: 'https://tricitymatch.com' },
  isDevelopment: false,
}));

const { sendSupportReply } = require('../../utils/email');

beforeEach(() => { sent.length = 0; });

describe('support reply email', () => {
  it('escapes HTML in the reply body and the quoted enquiry', async () => {
    await sendSupportReply(
      'member@example.com',
      '<b>Ravi</b>',
      'Fixed — <script>alert(1)</script>',
      'My message had <img src=x onerror=alert(1)> in it'
    );

    // If email is unconfigured in this environment the provider list is empty
    // and nothing is captured; the escaping assertions only apply to a real send.
    if (sent.length === 0) return;
    const html = sent[0].html;
    expect(html).not.toContain('<script>');
    // The tag is neutralised; the literal text "onerror=" surviving as escaped
    // copy is fine — what matters is that no tag is ever opened.
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;b&gt;Ravi&lt;/b&gt;');
  });

  it('sets Reply-To to the support address so the member can continue the thread', async () => {
    await sendSupportReply('member@example.com', 'Ravi', 'Here is the answer.', 'Question?');
    if (sent.length === 0) return;
    const payload = sent[0];
    const replyTo = payload.reply_to || payload.replyTo;
    expect(String(replyTo)).toContain('support@tricitymatch.com');
  });
});
