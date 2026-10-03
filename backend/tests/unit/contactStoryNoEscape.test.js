/**
 * SITE-07: contact and success-story text is stored as typed (no HTML entities),
 * and the support notification email escapes it where it builds HTML.
 */
const { validationResult } = require('express-validator');

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(() => Promise.resolve({})) }));

const { contactValidation, successStoryValidation } = require('../../validators');

const run = async (rules, body) => {
  const req = { body, headers: {}, query: {}, params: {} };
  for (const rule of rules) await rule.run(req);
  return { req, errors: validationResult(req).array() };
};

describe('contact + success story validators', () => {
  it('keeps apostrophes, ampersands, slashes and angle brackets as typed', async () => {
    const { req, errors } = await run(contactValidation, {
      name: "Asha O'Neil", email: 'a@example.com', phone: '98765 43210',
      subject: 'R&D / support', message: 'Price < 500 & "free" shipping, it\'s fine',
    });
    expect(errors).toEqual([]);
    expect(req.body.name).toBe("Asha O'Neil");
    expect(req.body.subject).toBe('R&D / support');
    expect(req.body.message).toBe('Price < 500 & "free" shipping, it\'s fine');
  });

  it('success story fields are stored as typed', async () => {
    const { req, errors } = await run(successStoryValidation, { coupleNames: "Ravi & Simran", quote: "We met at Rock Garden — it's true", location: 'Sector 17/18' });
    expect(errors).toEqual([]);
    expect(req.body.coupleNames).toBe('Ravi & Simran');
    expect(req.body.quote).toBe("We met at Rock Garden — it's true");
    expect(req.body.location).toBe('Sector 17/18');
  });
});

describe('support notification email', () => {
  it('escapes enquiry text in the HTML body, leaves the plain-text body raw', async () => {
    jest.mock('../../models', () => ({ ContactMessage: { create: jest.fn(async (d) => ({ id: 'x', ...d })) }, SuccessStory: {} }));
    const { sendEmail } = require('../../utils/email');
    const { submitContact } = require('../../controllers/contactController');
    const res = { status() { return this; }, json() { return this; } };
    submitContact({ body: { name: '<b>x</b>', email: 'a@example.com', message: '<img src=x onerror=alert(1)> & more', subject: "it's" }, ip: '1.1.1.1' }, res, () => {});
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).not.toContain('<img');
    expect(arg.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; more');
    expect(arg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(arg.text).toContain('<img src=x onerror=alert(1)> & more');
  });
});
