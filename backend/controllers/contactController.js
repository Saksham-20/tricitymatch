const { ContactMessage, SuccessStory } = require('../models');
const { asyncHandler, createError } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { sendEmail } = require('../utils/email');
const config = require('../config/env');
const { findContactInText } = require('../utils/contactInText');

// Enquiry text is stored as typed; escape it where it is placed into HTML.
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// POST /api/v1/contact  (public, rate-limited)
// Stores the enquiry durably, then best-effort emails support (no-ops cleanly
// when SMTP is unconfigured — see utils/email.sendEmail).
const submitContact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  const record = await ContactMessage.create({
    name,
    email,
    phone: phone || null,
    subject: subject || null,
    message,
    ipAddress: req.ip,
  });

  // Best-effort notification — never block or fail the request on email.
  try {
    const safeSubject = subject ? `Contact form: ${subject}` : 'New contact form enquiry';
    await sendEmail({
      to: config.email.support,
      channel: 'documents', // admin/support notification → SMTP-first
      replyTo: email, // reply goes straight to the enquirer
      subject: safeSubject,
      html: `
        <h2>New contact enquiry</h2>
        <p><strong>Name:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> ${esc(email)}</p>
        ${phone ? `<p><strong>Phone:</strong> ${esc(phone)}</p>` : ''}
        ${subject ? `<p><strong>Subject:</strong> ${esc(subject)}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${esc(message).replace(/\n/g, '<br>')}</p>
      `,
      text: `New contact enquiry\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ''}${subject ? `\nSubject: ${subject}` : ''}\n\n${message}`,
    });
  } catch (err) {
    log.warn('Contact email notification failed (enquiry still stored)', { error: err.message, id: record.id });
  }

  log.info('Contact enquiry received', { id: record.id, email });

  res.status(201).json({
    success: true,
    message: "Thanks for reaching out — we've received your message and will reply soon.",
  });
});

// POST /api/v1/success-stories  (public, rate-limited)
// Members submit their own story; it lands as a `draft` for an admin to review
// and publish (admins manage these via /admin/success-stories). Accepts either a
// pre-joined `coupleNames` or separate groom/bride names.
const submitSuccessStory = asyncHandler(async (req, res) => {
  const { coupleNames, groomName, brideName, quote, story, marriedOn, weddingDate, location } = req.body;

  const names = coupleNames
    ? String(coupleNames).trim()
    : [brideName, groomName].map((n) => (n ? String(n).trim() : '')).filter(Boolean).join(' & ');
  const text = String(quote ?? story ?? '').trim();

  if (!names || !text) {
    throw createError.badRequest('Couple names and your story are required');
  }

  // Published stories are public pages: no phone numbers, emails or handles in
  // them, the same rule as profile text.
  if ([names, text, location].some((v) => typeof v === 'string' && findContactInText(v))) {
    throw createError.badRequest('Please take out phone numbers, email addresses, links and handles. Stories are published on the website for everyone to read.');
  }

  const record = await SuccessStory.create({
    coupleNames: names.slice(0, 255),
    // Hard cap independent of the validator: `quote` was previously written
    // with no length bound at all.
    quote: text.slice(0, 5000),
    marriedOn: marriedOn || weddingDate || null,
    location: location ? String(location).trim().slice(0, 255) : null,
    status: 'draft', // never auto-publish user-submitted content
  });

  log.info('Success story submitted (pending review)', { id: record.id });

  res.status(201).json({
    success: true,
    message: "Thank you for sharing your story! Our team will review it before publishing.",
  });
});

module.exports = { submitContact, submitSuccessStory };
