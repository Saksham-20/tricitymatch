const { ContactMessage } = require('../models');
const { asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { sendEmail } = require('../utils/email');
const config = require('../config/env');

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
    await sendEmail(config.email.support, {
      subject: safeSubject,
      html: `
        <h2>New contact enquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${String(message).replace(/\n/g, '<br>')}</p>
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

module.exports = { submitContact };
