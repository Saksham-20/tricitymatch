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

// "TricityMatch <noreply@tricitymatch.com>"
const fromHeader = () => `${config.email.fromName} <${config.email.from || config.email.user}>`;

// Single-provider send primitives. Throw on failure so the router can fall back.
const sendViaResend = async ({ from, to, subject, html, text, reply, headers }) => {
  const { data, error } = await getResend().emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text ? { text } : {}),
    ...(reply ? { replyTo: reply } : {}),
    ...(headers ? { headers } : {}),
  });
  if (error) throw new Error(error.message || String(error));
  log.info('Email sent (resend)', { to, subject, messageId: data && data.id });
  return { success: true, messageId: data && data.id, provider: 'resend' };
};

const sendViaSmtp = async ({ from, to, subject, html, text, reply, headers }) => {
  const info = await getTransporter().sendMail({
    from, to, subject, html, text,
    ...(reply ? { replyTo: reply } : {}),
    ...(headers ? { headers } : {}),
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
const deliver = async ({ to, subject, html, text, replyTo, channel = 'transactional', headers }) => {
  const from = fromHeader();
  const reply = replyTo || config.email.replyTo;
  const order = CHANNEL_ORDER[channel] || CHANNEL_ORDER.transactional;
  const configured = order.filter((name) => PROVIDERS[name].isConfigured());

  if (configured.length === 0) {
    // Surface the code-carrying subject so OTP/reset flows stay testable locally.
    log.warn('Email not configured, skipping send', { to, subject, channel });
    return { success: false, reason: 'Email not configured' };
  }

  // Dry run (default outside production): render everything, send nothing, and
  // report success so callers exercise their real paths. The dev environment
  // shares production's Resend key, so a batch job run locally would otherwise
  // spend the live daily quota and take production OTP mail down with it.
  if (config.email.dryRun) {
    log.info('Email dry run — not sent', { to, subject, channel, provider: configured[0] });
    return { success: true, dryRun: true };
  }

  let lastError;
  for (const name of configured) {
    try {
      return await PROVIDERS[name].send({ from, to, subject, html, text, reply, headers });
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

// Header mark. Mail clients cannot render SVG, so this is the PNG cut
// (red glyphs on a white tile — the header band is burgundy, and the red
// plate used elsewhere has no contrast on it) served by the web app.
// The wordmark below it stays real text, so a client that blocks images
// still shows the brand.
const LOGO_URL = `${config.server.frontendUrl}/icons/email-logo.png?v=1`;

/**
 * brandLayout — wraps body HTML in the shared TricityMatch shell.
 * @param {object} o
 * @param {string} o.eyebrow  small uppercase label under the wordmark
 * @param {string} o.bodyHtml inner content (already-escaped/trusted)
 * @param {string} [o.preheader] hidden inbox-preview line
 * @param {{href:string,label:string,gold?:boolean}} [o.cta] primary button
 * @param {string} [o.unsubscribeUrl] adds the reminder-mail opt-out line to the footer
 */
const brandLayout = ({ eyebrow, bodyHtml, preheader = '', cta, unsubscribeUrl }) => `
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
          <img src="${LOGO_URL}" width="56" height="56" alt="TricityMatch" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:56px;height:56px;border-radius:13px;" />
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">TricityMatch</div>
          <div style="height:3px;width:46px;background:${BRAND.gold};margin:11px auto 0;border-radius:2px;"></div>
          ${eyebrow ? `<div style="color:#F1E2D5;font-size:11px;margin-top:12px;letter-spacing:1.5px;text-transform:uppercase;">${eyebrow}</div>` : ''}
        </td></tr>
        <tr><td style="padding:32px;color:${BRAND.ink};font-size:15px;line-height:1.65;">
          ${bodyHtml}
          ${cta ? `<div style="text-align:center;margin:30px 0 6px;"><a href="${cta.href}" style="display:inline-block;${cta.gold ? `background:${BRAND.gold};color:#2D2D2D;` : `background:${BRAND.burgundy};color:#ffffff;`}text-decoration:none;font-weight:600;font-size:14px;padding:13px 32px;border-radius:8px;">${cta.label}</a></div>` : ''}
        </td></tr>
        <tr><td style="background:${BRAND.bg};padding:22px 32px;text-align:center;border-top:1px solid ${BRAND.border};">
          <div style="color:${BRAND.soft};font-size:12px;line-height:1.7;">
            TricityMatch &middot; Chandigarh &middot; Mohali &middot; Panchkula<br/>
            Questions? <a href="mailto:${config.email.support}" style="color:${BRAND.burgundy};text-decoration:none;font-weight:600;">${config.email.support}</a>
          </div>
          ${unsubscribeUrl ? `<div style="color:${BRAND.soft};font-size:12px;line-height:1.6;margin-top:12px;">You are getting this reminder because you have a TricityMatch account. <a href="${escapeHtml(unsubscribeUrl)}" style="color:${BRAND.soft};text-decoration:underline;">Unsubscribe from reminder emails</a></div>` : ''}
          <div style="color:#B8AEA4;font-size:11px;margin-top:10px;">© ${new Date().getFullYear()} TricityMatch. All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// Every value that originates OUTSIDE this file is escaped before it is
// interpolated into HTML: member names, a matched member's name, admin-typed
// rejection reasons, support replies, plan/expiry strings and security-alert
// detail. Only developer-authored copy is interpolated raw.
//
// The signup/profile validators restrict firstName to [a-zA-Z\s'-], which is
// why this was not already exploitable — but that regex was the ONLY control
// between a member-supplied name and outbound HTML mail, and the Google
// sign-in path (given_name straight from the ID token) never runs it.
// A single-control dependency on a template that reaches other people's
// inboxes is not a place to rely on validation alone.
const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Reminder / promotional mail carries an opt-out: a footer link for people and
// the RFC 8058 headers for Gmail/Yahoo's own "Unsubscribe" button. Mail about a
// member's own money or account (payment problems, dates, OTP, security) never
// does — it is not optional.
const unsubscribeHeaders = (unsub) => (unsub && unsub.oneClickUrl ? {
  'List-Unsubscribe': `<${unsub.oneClickUrl}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
} : undefined);
const unsubscribeText = (unsub) => (unsub && unsub.pageUrl ? `\n\nUnsubscribe from reminder emails: ${unsub.pageUrl}` : '');

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
    subject: 'Welcome to TricityMatch',
    html: brandLayout({
      eyebrow: 'Welcome',
      preheader: 'Your TricityMatch journey starts here.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Welcome to TricityMatch. We're glad you're here, and we'll help you find the right match with people from Chandigarh, Mohali and Panchkula.</p>
        <p style="margin-bottom:8px;">A few things to do next:</p>
        <ul style="margin:0 0 8px 0;padding-left:20px;color:${BRAND.soft};">
          <li>Complete your profile so you appear in more searches</li>
          <li>Add a few clear photos</li>
          <li>Start browsing profiles near you</li>
        </ul>`,
      cta: { href: `${config.server.frontendUrl}/profile/edit`, label: 'Complete Your Profile' },
    }),
    text: `Welcome to TricityMatch, ${name}! Complete your profile to get started: ${config.server.frontendUrl}/profile/edit`,
  }),

  passwordReset: (name, resetLink) => ({
    subject: 'Reset your password — TricityMatch',
    html: brandLayout({
      eyebrow: 'Password Reset',
      preheader: 'Reset your TricityMatch password (link expires in 1 hour).',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>We received a request to reset your password. Use the button below to choose a new one.</p>
        ${panel(`<strong>This link expires in 1 hour</strong> for your security.`, { accent: BRAND.gold })}
        <p style="color:${BRAND.soft};font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      cta: { href: resetLink, label: 'Reset Password' },
    }),
    text: `Hi ${name}, Reset your password: ${resetLink} — this link expires in 1 hour. If you didn't request this, ignore this email.`,
  }),

  matchNotification: (name, matchName) => ({
    subject: `You matched with ${matchName} — TricityMatch`,
    html: brandLayout({
      eyebrow: "It's a Match",
      preheader: `You and ${escapeHtml(matchName)} liked each other.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Good news — you and <strong>${escapeHtml(matchName)}</strong> have both expressed interest. You can now start a conversation.</p>`,
      cta: { href: `${config.server.frontendUrl}/matches`, label: 'View Match' },
    }),
    text: `Hi ${name}, you and ${matchName} matched on TricityMatch. Start a conversation: ${config.server.frontendUrl}/matches`,
  }),

  subscriptionConfirmation: (name, plan, expiryDate) => ({
    channel: 'documents', // payment receipt → SMTP-first (falls back to Resend)
    subject: 'Your TricityMatch membership is confirmed',
    html: brandLayout({
      eyebrow: 'Membership Confirmed',
      preheader: `Your ${escapeHtml(planLabel(plan))} membership is active until ${escapeHtml(expiryDate)}.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Thank you for upgrading. Your payment was processed successfully and your membership is now active.</p>
        ${panel(
          `<p style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:16px;color:${BRAND.burgundy};font-weight:700;">${escapeHtml(planLabel(plan))}</p>
           <p style="margin:0;color:${BRAND.soft};font-size:13px;">Valid until <strong style="color:${BRAND.ink};">${escapeHtml(expiryDate)}</strong></p>`,
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
    subject: 'Photo verification update — TricityMatch',
    html: brandLayout({
      eyebrow: 'Verification Update',
      preheader: 'We could not verify your photo this time.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>We weren't able to verify your profile from the selfie you submitted.</p>
        ${reason ? panel(`<strong>Reason:</strong> ${escapeHtml(reason)}`) : ''}
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
    subject: 'Your profile is verified — TricityMatch',
    html: brandLayout({
      eyebrow: 'Profile Verified',
      preheader: 'Your verified badge is now live.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Congratulations — your profile is now verified. A verified badge is live on your profile, which builds trust and typically brings more responses.</p>`,
      cta: { href: `${config.server.frontendUrl}/profile`, label: 'View Your Profile' },
    }),
    text: `Hi ${name}, your TricityMatch profile is now verified. View it: ${config.server.frontendUrl}/profile`,
  }),

  weeklyDigest: (name, matchCount, profilesHtml, unsub) => ({
    subject: `${matchCount} new matches this week on TricityMatch`,
    html: brandLayout({
      eyebrow: 'Your Weekly Matches',
      preheader: `${matchCount} new profiles match your preferences this week.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>New members have joined TricityMatch this week who match your preferences — here's a look.</p>
        ${profilesHtml || ''}
        <p style="color:${BRAND.soft};font-size:13px;text-align:center;margin-top:18px;">Log in to see full profiles and send interest.</p>`,
      cta: { href: `${config.server.frontendUrl}/search`, label: 'View All Matches' },
      unsubscribeUrl: unsub && unsub.pageUrl,
    }),
    text: `Hi ${name}, You have ${matchCount} new profiles matching your preferences this week on TricityMatch. Log in to view them: ${config.server.frontendUrl}/search${unsubscribeText(unsub)}`,
    headers: unsubscribeHeaders(unsub),
  }),

  // ── Lifecycle mail ─────────────────────────────────────────────────────
  // Calm by design (rewritten 2026-09-19 after one order was mailed 24 times in
  // a day): sentence case, real dates, no countdowns, no "last chance", no
  // guilt, no exclamation marks, no discount escalation. Each one says what
  // happened, what it means, and offers one button and a person to reply to.
  // Cadence and the once-per-row guarantee live in utils/lifecycleMail.js.

  // A payment attempt failed and the order is still open. This is about the
  // member's money, so it says exactly what happened to it and never sells.
  paymentFailed: (name, planName, price) => ({
    subject: 'We could not complete your payment',
    html: brandLayout({
      eyebrow: 'Payment',
      preheader: `Your ${planName} payment did not go through.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Your payment for the <strong>${escapeHtml(planName)}</strong> membership${price ? ` (₹${escapeHtml(String(price))})` : ''} did not go through, so the membership has not started.</p>
        <p>If any money was taken from your account, your bank returns it automatically, usually within 5&ndash;7 working days. You do not need to do anything for that.</p>
        <p>You can try again whenever you like. If it keeps failing, or the money left your account and Premium is not active, just reply to this email with your payment ID and a person will look into it.</p>`,
      cta: { href: `${config.server.frontendUrl}/subscription`, label: 'Try again' },
    }),
    text: `Hi ${name}, your payment for the ${planName} membership did not go through, so it has not started. If any money was taken, your bank returns it automatically, usually within 5-7 working days. Try again: ${config.server.frontendUrl}/subscription. If it keeps failing, reply to this email with your payment ID and we will look into it.`,
  }),

  // Closed the payment window without paying. Sent once, a day or more later,
  // and at most once a month — never a chase. It answers the questions people
  // actually stop on, and states only what the published policies say.
  checkoutFollowUp: (name, planName, unsub) => ({
    subject: 'Questions about Premium?',
    html: brandLayout({
      eyebrow: 'A quick note',
      preheader: 'Nothing was charged. Here is what to know before you decide.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>You recently looked at the <strong>${escapeHtml(planName)}</strong> membership and did not go ahead. Nothing was charged, and there is no rush.</p>
        <p>In case it helps you decide: it is a single payment with no auto-renewal, and you can ask for a refund within seven days of paying without giving a reason. The details are on our <a href="${config.server.frontendUrl}/refund-policy" style="color:${BRAND.burgundy};">refund policy</a> page.</p>
        <p>If something else is holding you back, reply to this email and a person will answer.</p>`,
      cta: { href: `${config.server.frontendUrl}/subscription`, label: 'See Premium' },
      unsubscribeUrl: unsub && unsub.pageUrl,
    }),
    text: `Hi ${name}, you looked at the ${planName} membership and did not go ahead. Nothing was charged and there is no rush. It is a single payment with no auto-renewal, and you can ask for a refund within seven days of paying without giving a reason (${config.server.frontendUrl}/refund-policy). Questions? Reply to this email. ${config.server.frontendUrl}/subscription${unsubscribeText(unsub)}`,
    headers: unsubscribeHeaders(unsub),
  }),

  // Ends on a real date, said plainly.
  renewalReminder: (name, planName, expiryDate, daysLeft) => ({
    subject: `Your ${planName} membership ends on ${expiryDate}`,
    html: brandLayout({
      eyebrow: 'Membership',
      preheader: `Your ${planName} membership ends on ${expiryDate}.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Your <strong>${escapeHtml(planName)}</strong> membership ends on <strong>${escapeHtml(expiryDate)}</strong>, ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}.</p>
        <p>After that you keep your profile and your matches; contact details and messaging go back to the free limits. If you are in the middle of conversations, renewing before that date means no gap.</p>`,
      cta: { href: `${config.server.frontendUrl}/subscription`, label: 'View membership' },
    }),
    text: `Hi ${name}, your ${planName} membership ends on ${expiryDate}. You keep your profile and matches afterwards; contact details and messaging return to the free limits. ${config.server.frontendUrl}/subscription`,
  }),

  // The day it lapsed. Informational.
  membershipExpired: (name, planName) => ({
    subject: `Your ${planName} membership has ended`,
    html: brandLayout({
      eyebrow: 'Membership',
      preheader: `Your ${planName} membership has ended.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Your <strong>${escapeHtml(planName)}</strong> membership has ended. Your profile, photos, matches and conversations are all still there; only contact unlocks and messaging are back to the free limits.</p>
        <p>You can pick up where you left off whenever you are ready.</p>`,
      cta: { href: `${config.server.frontendUrl}/subscription`, label: 'View membership' },
    }),
    text: `Hi ${name}, your ${planName} membership has ended. Your profile and matches are unchanged; contact unlocks and messaging are back to the free limits. ${config.server.frontendUrl}/subscription`,
  }),

  // A fortnight after expiry, and only if there is something real to come back
  // for — the caller passes the count and skips the send when it is zero.
  winBack: (name, newProfiles, unsub) => ({
    subject: `${newProfiles} new ${newProfiles === 1 ? 'profile' : 'profiles'} in the Tricity since your membership ended`,
    html: brandLayout({
      eyebrow: 'New members',
      preheader: `${newProfiles} new ${newProfiles === 1 ? 'member has' : 'members have'} joined.`,
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p><strong>${escapeHtml(String(newProfiles))} new ${newProfiles === 1 ? 'member' : 'members'}</strong> from the Tricity ${newProfiles === 1 ? 'has' : 'have'} joined since your membership ended. Your profile is exactly as you left it.</p>`,
      cta: { href: `${config.server.frontendUrl}/search`, label: 'See who has joined' },
      unsubscribeUrl: unsub && unsub.pageUrl,
    }),
    text: `Hi ${name}, ${newProfiles} new ${newProfiles === 1 ? 'member has' : 'members have'} joined TricityMatch since your membership ended. ${config.server.frontendUrl}/search${unsubscribeText(unsub)}`,
    headers: unsubscribeHeaders(unsub),
  }),

  // No photo on the profile. One plain ask, made at most twice.
  addPhotoNudge: (name, unsub) => ({
    subject: 'Add a photo to your TricityMatch profile',
    html: brandLayout({
      eyebrow: 'Your profile',
      preheader: 'A photo helps people trust a profile.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p>Your profile is live but has no photo yet. Most people open the profiles that have one first, so it is the simplest way to be seen.</p>
        <p>Your photos stay private from anyone you have not matched with, and you can blur them for non-matches in Settings &rarr; Privacy.</p>`,
      cta: { href: `${config.server.frontendUrl}/profile/edit?section=photos`, label: 'Add a photo' },
      unsubscribeUrl: unsub && unsub.pageUrl,
    }),
    text: `Hi ${name}, your TricityMatch profile is live but has no photo yet. Add one: ${config.server.frontendUrl}/profile/edit?section=photos${unsubscribeText(unsub)}`,
    headers: unsubscribeHeaders(unsub),
  }),

  // One-time verification code (email OTP: signup / email-change).
  otpCode: (code, purpose = 'verify your email') => ({
    subject: 'Your TricityMatch verification code',
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
    text: `Your TricityMatch verification code is ${code}. Valid for 10 minutes. Do not share it. If you didn't request this, ignore this email.`,
  }),

  // Security alert (new login, password changed, suspicious activity…).
  securityAlert: (name, title, detail, when) => ({
    subject: `Security alert: ${title} — TricityMatch`,
    html: brandLayout({
      eyebrow: 'Security Alert',
      preheader: escapeHtml(title),
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name || 'there')},</p>
        <p>${escapeHtml(detail)}</p>
        ${panel(
          `${when ? `<p style="margin:0 0 6px 0;"><strong>When:</strong> ${escapeHtml(when)}</p>` : ''}<p style="margin:0;color:${BRAND.soft};">If this was you, no action is needed.</p>`,
          { accent: BRAND.gold }
        )}
        <p><strong>If this wasn't you</strong>, reset your password immediately and review your active sessions.</p>`,
      cta: { href: `${config.server.frontendUrl}/settings`, label: 'Review Account Security' },
    }),
    text: `Hi ${name || 'there'}, Security alert: ${title}. ${detail}${when ? ' When: ' + when + '.' : ''} If this wasn't you, reset your password immediately at ${config.server.frontendUrl}/settings.`,
  }),

  // Support agent's answer to a contact-form enquiry. `replyTo` is the support
  // address so the member can simply hit Reply and continue the thread — the
  // whole point of the reply path is that support stops being write-only.
  supportReply: (name, replyBody, originalMessage) => ({
    subject: 'Re: your message to TricityMatch',
    replyTo: config.email.support,
    html: brandLayout({
      eyebrow: 'Support',
      preheader: 'A reply from the TricityMatch support team.',
      bodyHtml: `
        <p style="margin-top:0;">Hi ${escapeHtml(name || 'there')},</p>
        <p>Thanks for writing to us. Here's our reply:</p>
        ${panel(`<div style="white-space:pre-wrap;">${escapeHtml(replyBody)}</div>`)}
        ${originalMessage ? `<p style="color:${BRAND.soft};font-size:13px;margin-top:24px;">You wrote:</p>${panel(`<div style="white-space:pre-wrap;color:${BRAND.soft};font-size:13px;">${escapeHtml(originalMessage)}</div>`, { accent: BRAND.gold })}` : ''}
        <p style="margin-bottom:0;">Just reply to this email if you need anything else.</p>
      `,
    }),
    text: `Hi ${name || 'there'},\n\n${replyBody}\n\n— TricityMatch Support (${config.email.support})`,
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
    const { to, subject, html, text, replyTo, channel, headers } = arg1;
    return deliver({ to, subject, html, text, replyTo, channel, headers });
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
    headers: emailContent.headers,
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
const sendWeeklyDigest = (to, name, matchCount, profilesHtml, unsub) =>
  sendEmail(to, 'weeklyDigest', { name, matchCount, profilesHtml, unsub });

// Send email OTP (branded template)
const sendOtpEmail = (to, code, purpose) => sendEmail(to, 'otpCode', { code, purpose });

// Send security alert
const sendSecurityAlert = (to, name, title, detail, when) =>
  sendEmail(to, 'securityAlert', { name, title, detail, when });

// Reply to a contact-form enquiry (admin support inbox).
const sendSupportReply = (to, name, replyBody, originalMessage) =>
  sendEmail(to, 'supportReply', { name, replyBody, originalMessage });

// ── Lifecycle senders ───────────────────────────────────────────────────
// `sendEmail(to, name, data)` spreads data by key ORDER, so each object below
// must list its keys in the template's parameter order.
const sendPaymentFailed = (to, name, planName, price) =>
  sendEmail(to, 'paymentFailed', { name, planName, price });

const sendCheckoutFollowUp = (to, name, planName, unsub) =>
  sendEmail(to, 'checkoutFollowUp', { name, planName, unsub });

const sendRenewalReminder = (to, name, planName, expiryDate, daysLeft) =>
  sendEmail(to, 'renewalReminder', { name, planName, expiryDate, daysLeft });

const sendMembershipExpired = (to, name, planName) =>
  sendEmail(to, 'membershipExpired', { name, planName });

const sendWinBack = (to, name, newProfiles, unsub) =>
  sendEmail(to, 'winBack', { name, newProfiles, unsub });

const sendAddPhotoNudge = (to, name, unsub) => sendEmail(to, 'addPhotoNudge', { name, unsub });

module.exports = {
  sendEmail,
  sendPaymentFailed,
  sendCheckoutFollowUp,
  sendRenewalReminder,
  sendMembershipExpired,
  sendWinBack,
  sendAddPhotoNudge,
  sendSupportReply,
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
