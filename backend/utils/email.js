/**
 * Email Utility
 * Handles email sending with templates
 */

const nodemailer = require('nodemailer');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

// ── Providers ────────────────────────────────────────────────────────────────
// Two channels, per-purpose routed:
//   'transactional' (OTP, reset, verification, security alerts, notices) → Resend first
//   'documents'     (invoices, receipts, admin notices, support replies)  → SMTP first
// Each channel falls back to the OTHER configured provider, so 'documents' still
// ship via Resend until SMTP is wired, then auto-switch once EMAIL_USER/PASSWORD
// are set. No provider configured → no-op (dev-log). Callers never touch this.

let resendClient = null;
const getResend = () => {
  if (resendClient) return resendClient;
  const { Resend } = require('resend');
  resendClient = new Resend(config.email.resend.apiKey);
  return resendClient;
};

let transporter = null;
const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10, // messages per second
  });

  // Verify connection on startup
  transporter.verify((error) => {
    if (error) {
      log.error('Email transporter verification failed', { error: error.message });
    } else {
      log.info('Email transporter ready');
    }
  });

  return transporter;
};

// "TricityShadi <noreply@tricityshadi.com>"
const fromHeader = () => `${config.email.fromName} <${config.email.from || config.email.user}>`;

// Single-provider send primitives. Throw on failure so the router can fall back.
const sendViaResend = async ({ from, to, subject, html, text, reply }) => {
  const { data, error } = await getResend().emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text ? { text } : {}),
    ...(reply ? { replyTo: reply } : {}),
  });
  if (error) throw new Error(error.message || String(error));
  log.info('Email sent (resend)', { to, subject, messageId: data && data.id });
  return { success: true, messageId: data && data.id, provider: 'resend' };
};

const sendViaSmtp = async ({ from, to, subject, html, text, reply }) => {
  const info = await getTransporter().sendMail({
    from, to, subject, html, text,
    ...(reply ? { replyTo: reply } : {}),
  });
  log.info('Email sent (smtp)', { to, subject, messageId: info.messageId });
  return { success: true, messageId: info.messageId, provider: 'smtp' };
};

const PROVIDERS = {
  resend: { isConfigured: () => config.email.resend.isConfigured(), send: sendViaResend },
  smtp: { isConfigured: () => config.email.smtpConfigured(), send: sendViaSmtp },
};

// Channel → provider preference order (falls back to the other one).
const CHANNEL_ORDER = {
  transactional: ['resend', 'smtp'],
  documents: ['smtp', 'resend'],
};

// Low-level send. Routes by channel with fallback; never throws — always resolves
// { success, ... } so a mail failure can't break a request flow.
const deliver = async ({ to, subject, html, text, replyTo, channel = 'transactional' }) => {
  const from = fromHeader();
  const reply = replyTo || config.email.replyTo;
  const order = CHANNEL_ORDER[channel] || CHANNEL_ORDER.transactional;
  const configured = order.filter((name) => PROVIDERS[name].isConfigured());

  if (configured.length === 0) {
    // Surface the code-carrying subject so OTP/reset flows stay testable locally.
    log.warn('Email not configured, skipping send', { to, subject, channel });
    return { success: false, reason: 'Email not configured' };
  }

  let lastError;
  for (const name of configured) {
    try {
      return await PROVIDERS[name].send({ from, to, subject, html, text, reply });
    } catch (error) {
      lastError = error;
      log.error(`Email send failed via ${name}`, { to, subject, channel, error: error.message });
      // fall through to next configured provider
    }
  }
  return { success: false, error: lastError ? lastError.message : 'send failed' };
};

// ── Shared brand palette + layout ────────────────────────────────────────────
// One professional, table-based (email-client-safe) shell used by every
// transactional email: burgundy header, gold hairline accent, muted footer with
// the real support address. No off-brand gradients.
const BRAND = {
  burgundy: '#8B2346',
  gold: '#C9A227',
  ink: '#2D2D2D',
  soft: '#6B6B6B',
  bg: '#FAF7F3',
  border: '#EFE7E0',
  panelBorder: '#E7DCD3',
};

/**
 * brandLayout — wraps body HTML in the shared TricityShadi shell.
 * @param {object} o
 * @param {string} o.eyebrow  small uppercase label under the wordmark
 * @param {string} o.bodyHtml inner content (already-escaped/trusted)
 * @param {string} [o.preheader] hidden inbox-preview line
 * @param {{href:string,label:string,gold?:boolean}} [o.cta] primary button
 */
const brandLayout = ({ eyebrow, bodyHtml, preheader = '', cta }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.bg};">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.border};">
        <tr><td style="background:${BRAND.burgundy};padding:30px 32px;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">TricityShadi</div>
          <div style="height:3px;width:46px;background:${BRAND.gold};margin:11px auto 0;border-radius:2px;"></div>
          ${eyebrow ? `<div style="color:#F1E2D5;font-size:11px;margin-top:12px;letter-spacing:1.5px;text-transform:uppercase;">${eyebrow}</div>` : ''}
        </td></tr>
        <tr><td style="padding:32px;color:${BRAND.ink};font-size:15px;line-height:1.65;">
          ${bodyHtml}
          ${cta ? `<div style="text-align:center;margin:30px 0 6px;"><a href="${cta.href}" style="display:inline-block;${cta.gold ? `background:${BRAND.gold};color:#2D2D2D;` : `background:${BRAND.burgundy};color:#ffffff;`}text-decoration:none;font-weight:600;font-size:14px;padding:13px 32px;border-radius:8px;">${cta.label}</a></div>` : ''}
        </td></tr>
        <tr><td style="background:${BRAND.bg};padding:22px 32px;text-align:center;border-top:1px solid ${BRAND.border};">
          <div style="color:${BRAND.soft};font-size:12px;line-height:1.7;">
            TricityShadi &middot; Chandigarh &middot; Mohali &middot; Panchkula<br/>
            Questions? <a href="mailto:${config.email.support}" style="color:${BRAND.burgundy};text-decoration:none;font-weight:600;">${config.email.support}</a>
          </div>
          <div style="color:#B8AEA4;font-size:11px;margin-top:10px;">© ${new Date().getFullYear()} TricityShadi. All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// Small reusable panel (used for plan box, reason box, etc.)
const panel = (inner, { accent = BRAND.burgundy } = {}) =>
  `<div style="background:${BRAND.bg};border:1px solid ${BRAND.panelBorder};border-left:3px solid ${accent};border-radius:8px;padding:16px 18px;margin:20px 0;">${inner}</div>`;

// Friendly display name for internal plan codes.
const PLAN_LABELS = {
  basic_premium: 'Basic',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI Connect',
};
const planLabel = (p) => PLAN_LABELS[p] || (p ? String(p).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Premium');

// Email templates
const templates = {
  welcome: (name) => ({
    subject: 'Welcome to TricityShadi',
    html: brandLayout({
      eyebrow: 'Welcome',
      preheader: 'Your TricityShadi journey starts here.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>Welcome to TricityShadi. We're glad you're here, and we'll help you find the right match with people from Chandigarh, Mohali and Panchkula.</p>
        <p style="margin-bottom:8px;">A few things to do next:</p>
        <ul style="margin:0 0 8px 0;padding-left:20px;color:${BRAND.soft};">
          <li>Complete your profile so you appear in more searches</li>
          <li>Add a few clear photos</li>
          <li>Start browsing profiles near you</li>
        </ul>`,
      cta: { href: `${config.server.frontendUrl}/profile/edit`, label: 'Complete Your Profile' },
    }),
    text: `Welcome to TricityShadi, ${name}! Complete your profile to get started: ${config.server.frontendUrl}/profile/edit`,
  }),

  passwordReset: (name, resetLink) => ({
    subject: 'Reset your password — TricityShadi',
    html: brandLayout({
      eyebrow: 'Password Reset',
      preheader: 'Reset your TricityShadi password (link expires in 1 hour).',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>We received a request to reset your password. Use the button below to choose a new one.</p>
        ${panel(`<strong>This link expires in 1 hour</strong> for your security.`, { accent: BRAND.gold })}
        <p style="color:${BRAND.soft};font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      cta: { href: resetLink, label: 'Reset Password' },
    }),
    text: `Hi ${name}, Reset your password: ${resetLink} — this link expires in 1 hour. If you didn't request this, ignore this email.`,
  }),

  matchNotification: (name, matchName) => ({
    subject: `You matched with ${matchName} — TricityShadi`,
    html: brandLayout({
      eyebrow: "It's a Match",
      preheader: `You and ${matchName} liked each other.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>Good news — you and <strong>${matchName}</strong> have both expressed interest. You can now start a conversation.</p>`,
      cta: { href: `${config.server.frontendUrl}/matches`, label: 'View Match' },
    }),
    text: `Hi ${name}, you and ${matchName} matched on TricityShadi. Start a conversation: ${config.server.frontendUrl}/matches`,
  }),

  subscriptionConfirmation: (name, plan, expiryDate) => ({
    channel: 'documents', // payment receipt → SMTP-first (falls back to Resend)
    subject: 'Your TricityShadi membership is confirmed',
    html: brandLayout({
      eyebrow: 'Membership Confirmed',
      preheader: `Your ${planLabel(plan)} membership is active until ${expiryDate}.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>Thank you for upgrading. Your payment was processed successfully and your membership is now active.</p>
        ${panel(
          `<p style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:16px;color:${BRAND.burgundy};font-weight:700;">${planLabel(plan)}</p>
           <p style="margin:0;color:${BRAND.soft};font-size:13px;">Valid until <strong style="color:${BRAND.ink};">${expiryDate}</strong></p>`,
          { accent: BRAND.gold }
        )}
        <p style="margin-bottom:8px;">Your membership includes:</p>
        <ul style="margin:0 0 8px 0;padding-left:20px;color:${BRAND.soft};">
          <li>View contact details of your matches</li>
          <li>Unlimited messaging</li>
          <li>See who's interested in you</li>
          <li>Advanced search filters &amp; priority visibility</li>
        </ul>`,
      cta: { href: `${config.server.frontendUrl}/dashboard`, label: 'Go to Dashboard', gold: true },
    }),
    text: `Hi ${name}, your ${planLabel(plan)} membership is confirmed and valid until ${expiryDate}. Go to your dashboard: ${config.server.frontendUrl}/dashboard`,
  }),

  verificationRejected: (name, reason) => ({
    subject: 'Photo verification update — TricityShadi',
    html: brandLayout({
      eyebrow: 'Verification Update',
      preheader: 'We could not verify your photo this time.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>We weren't able to verify your profile from the selfie you submitted.</p>
        ${reason ? panel(`<strong>Reason:</strong> ${reason}`) : ''}
        <p style="margin-bottom:8px;">Please re-take your live selfie, making sure it is:</p>
        <ul style="margin:0 0 8px 0;padding-left:20px;color:${BRAND.soft};">
          <li>Clear and well-lit</li>
          <li>Showing your full, unobstructed face</li>
          <li>A close match to the photos on your profile</li>
        </ul>`,
      cta: { href: `${config.server.frontendUrl}/verification`, label: 'Re-take Verification' },
    }),
    text: `Hi ${name}, your photo verification was not approved.${reason ? ' Reason: ' + reason : ''} Please re-take a clear, well-lit live selfie showing your full face: ${config.server.frontendUrl}/verification`,
  }),

  verificationApproved: (name) => ({
    subject: 'Your profile is verified — TricityShadi',
    html: brandLayout({
      eyebrow: 'Profile Verified',
      preheader: 'Your verified badge is now live.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>Congratulations — your profile is now verified. A verified badge is live on your profile, which builds trust and typically brings more responses.</p>`,
      cta: { href: `${config.server.frontendUrl}/profile`, label: 'View Your Profile' },
    }),
    text: `Hi ${name}, your TricityShadi profile is now verified. View it: ${config.server.frontendUrl}/profile`,
  }),

  weeklyDigest: (name, matchCount, profilesHtml) => ({
    subject: `${matchCount} new matches this week on TricityShadi`,
    html: brandLayout({
      eyebrow: 'Your Weekly Matches',
      preheader: `${matchCount} new profiles match your preferences this week.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name},</p>
        <p>New members have joined TricityShadi this week who match your preferences — here's a look.</p>
        ${profilesHtml || ''}
        <p style="color:${BRAND.soft};font-size:13px;text-align:center;margin-top:18px;">Log in to see full profiles and send interest.</p>`,
      cta: { href: `${config.server.frontendUrl}/search`, label: 'View All Matches' },
    }),
    text: `Hi ${name}, You have ${matchCount} new profiles matching your preferences this week on TricityShadi. Log in to view them: ${config.server.frontendUrl}/search`,
  }),

  // One-time verification code (email OTP: signup / email-change).
  otpCode: (code, purpose = 'verify your email') => ({
    subject: 'Your TricityShadi verification code',
    html: brandLayout({
      eyebrow: 'Verification Code',
      preheader: 'Your one-time verification code (valid 10 minutes).',
      bodyHtml: `
        <p style="margin-top:0;text-align:center;">Use this code to ${purpose}:</p>
        <div style="text-align:center;">
          <div style="font-size:32px;letter-spacing:10px;font-weight:700;color:${BRAND.burgundy};background:${BRAND.bg};border:2px solid ${BRAND.burgundy};border-radius:10px;padding:16px 24px;display:inline-block;margin:18px 0;">${code}</div>
        </div>
        <p style="text-align:center;color:${BRAND.soft};font-size:13px;">Valid for 10 minutes. Do not share it with anyone. If you didn't request this, you can safely ignore this email.</p>`,
    }),
    text: `Your TricityShadi verification code is ${code}. Valid for 10 minutes. Do not share it. If you didn't request this, ignore this email.`,
  }),

  // Security alert (new login, password changed, suspicious activity…).
  securityAlert: (name, title, detail, when) => ({
    subject: `Security alert: ${title} — TricityShadi`,
    html: brandLayout({
      eyebrow: 'Security Alert',
      preheader: title,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${name || 'there'},</p>
        <p>${detail}</p>
        ${panel(
          `${when ? `<p style="margin:0 0 6px 0;"><strong>When:</strong> ${when}</p>` : ''}<p style="margin:0;color:${BRAND.soft};">If this was you, no action is needed.</p>`,
          { accent: BRAND.gold }
        )}
        <p><strong>If this wasn't you</strong>, reset your password immediately and review your active sessions.</p>`,
      cta: { href: `${config.server.frontendUrl}/settings`, label: 'Review Account Security' },
    }),
    text: `Hi ${name || 'there'}, Security alert: ${title}. ${detail}${when ? ' When: ' + when + '.' : ''} If this wasn't you, reset your password immediately at ${config.server.frontendUrl}/settings.`,
  }),
};

// Send email. Accepts three call shapes (all historically used in this codebase):
//   sendEmail(to, 'templateName', data)        — named template + arg object
//   sendEmail(to, { subject, html, text })     — inline template object
//   sendEmail({ to, subject, html, text, replyTo }) — single options object
// (The last shape was previously broken against the old positional-only impl —
// the OTP-send path used it — so it silently no-op'd. Now normalized.)
// Optional `channel` ('transactional' default | 'documents') selects provider
// preference. Object-shape callers pass `channel` on the object; named templates
// declare their channel via `emailContent.channel` (see subscriptionConfirmation).
const sendEmail = async (arg1, template, data = {}) => {
  // Shape 3: single object with a `to` field.
  if (arg1 && typeof arg1 === 'object' && arg1.to) {
    const { to, subject, html, text, replyTo, channel } = arg1;
    return deliver({ to, subject, html, text, replyTo, channel });
  }

  const to = arg1;
  let emailContent;
  if (typeof template === 'string' && templates[template]) {
    emailContent = templates[template](...Object.values(data));
  } else if (template && typeof template === 'object') {
    emailContent = template;
  } else {
    log.error('Invalid email template', { to, template: typeof template === 'string' ? template : 'custom' });
    return { success: false, error: `Invalid email template: ${template}` };
  }

  return deliver({
    to,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    replyTo: emailContent.replyTo,
    channel: emailContent.channel,
  });
};

// Send welcome email
const sendWelcomeEmail = (to, name) => sendEmail(to, 'welcome', { name });

// Send password reset email
const sendPasswordResetEmail = (to, name, resetLink) => sendEmail(to, 'passwordReset', { name, resetLink });

// Send match notification
const sendMatchNotification = (to, name, matchName) => sendEmail(to, 'matchNotification', { name, matchName });

// Send subscription confirmation
const sendSubscriptionConfirmation = (to, name, plan, expiryDate) => 
  sendEmail(to, 'subscriptionConfirmation', { name, plan, expiryDate });

// Send verification approved email
const sendVerificationApproved = (to, name) => sendEmail(to, 'verificationApproved', { name });

// Send verification rejected email
const sendVerificationRejected = (to, name, reason) => sendEmail(to, 'verificationRejected', { name, reason });

// Send weekly digest email
const sendWeeklyDigest = (to, name, matchCount, profilesHtml) =>
  sendEmail(to, 'weeklyDigest', { name, matchCount, profilesHtml });

// Send email OTP (branded template)
const sendOtpEmail = (to, code, purpose) => sendEmail(to, 'otpCode', { code, purpose });

// Send security alert
const sendSecurityAlert = (to, name, title, detail, when) =>
  sendEmail(to, 'securityAlert', { name, title, detail, when });

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendMatchNotification,
  sendSubscriptionConfirmation,
  sendVerificationApproved,
  sendVerificationRejected,
  sendWeeklyDigest,
  sendOtpEmail,
  sendSecurityAlert,
  templates,
};
