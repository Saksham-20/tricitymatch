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

// Email templates
const templates = {
  welcome: (name) => ({
    subject: 'Welcome to TricityShadi!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to TricityShadi!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for joining TricityShadi! We're excited to help you find your perfect match.</p>
            <p>Here's what you can do next:</p>
            <ul>
              <li>Complete your profile to increase your visibility</li>
              <li>Upload your best photos</li>
              <li>Start browsing profiles in your area</li>
            </ul>
            <a href="${config.server.frontendUrl}" class="button">Complete Your Profile</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to TricityShadi, ${name}! Thank you for joining us. Complete your profile to get started.`
  }),

  passwordReset: (name, resetLink) => ({
    subject: 'Reset Your Password - TricityShadi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <div class="warning">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            <p style="margin-top: 20px;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, Reset your password by clicking this link: ${resetLink}. This link expires in 1 hour. If you didn't request this, ignore this email.`
  }),

  matchNotification: (name, matchName) => ({
    subject: `It's a Match! 🎉 - TricityShadi`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; text-align: center; }
          .button { display: inline-block; background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 It's a Match!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Great news! You and <strong>${matchName}</strong> have both liked each other!</p>
            <p>This could be the start of something special. Don't keep them waiting!</p>
            <a href="${config.server.frontendUrl}/matches" class="button">Start Chatting</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, It's a Match! You and ${matchName} have both liked each other. Start chatting now at ${config.server.frontendUrl}/matches`
  }),

  subscriptionConfirmation: (name, plan, expiryDate) => ({
    channel: 'documents', // payment receipt → SMTP-first (falls back to Resend)
    subject: 'Subscription Confirmed - TricityShadi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .plan-box { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #11998e; }
          .button { display: inline-block; background: #11998e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for subscribing! Your payment has been processed successfully.</p>
            <div class="plan-box">
              <h3 style="margin: 0 0 10px 0;">Your Plan</h3>
              <p style="margin: 0;"><strong>Plan:</strong> ${plan}</p>
              <p style="margin: 0;"><strong>Valid Until:</strong> ${expiryDate}</p>
            </div>
            <p>Enjoy all the premium features:</p>
            <ul>
              <li>Unlimited likes and matches</li>
              <li>See who liked you</li>
              <li>Priority profile visibility</li>
              <li>Advanced filters</li>
              ${plan.toLowerCase() === 'elite' ? '<li>Video calling feature</li>' : ''}
            </ul>
            <a href="${config.server.frontendUrl}/browse" class="button">Start Matching</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, Your ${plan} subscription is confirmed and valid until ${expiryDate}. Enjoy all premium features!`
  }),

  verificationRejected: (name, reason) => ({
    subject: 'Profile Verification Update - TricityShadi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .reason-box { background: #fff3f3; border: 1px solid #dc3545; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #8B2346; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verification Update</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We were unable to verify your profile at this time.</p>
            ${reason ? `<div class="reason-box"><strong>Reason:</strong> ${reason}</div>` : ''}
            <p>Please re-take your verification selfie, making sure it is:</p>
            <ul>
              <li>Clear and well-lit</li>
              <li>Shows your full, unobstructed face</li>
              <li>Matches the photos on your profile</li>
            </ul>
            <a href="${config.server.frontendUrl}/verification" class="button">Re-submit Verification</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
            <p>If you have questions, contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, Your verification was not approved.${reason ? ' Reason: ' + reason : ''} Please re-take a clear, well-lit selfie showing your full face.`
  }),

  verificationApproved: (name) => ({
    subject: 'Profile Verified! ✓ - TricityShadi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; text-align: center; }
          .badge { display: inline-block; background: #28a745; color: white; padding: 10px 20px; border-radius: 50px; margin: 20px 0; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Profile Verified!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Congratulations! Your profile has been verified.</p>
            <div class="badge">✓ Verified Profile</div>
            <p>Your profile will now display a verification badge, increasing trust and visibility.</p>
            <a href="${config.server.frontendUrl}/profile" class="button">View Your Profile</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, Congratulations! Your TricityShadi profile has been verified. You now have a verification badge.`
  }),

  weeklyDigest: (name, matchCount, profilesHtml) => ({
    subject: `${matchCount} new matches this week on TricityShadi 💌`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f8f4f0; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #7c1e3f, #a0294f); color: white; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
          .body { padding: 28px 24px; }
          .profiles { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
          .cta { text-align: center; margin: 28px 0 16px; }
          .btn { background: #7c1e3f; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block; }
          .footer { text-align: center; padding: 16px; background: #f8f4f0; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You have ${matchCount} new matches! 💌</h1>
            <p>New profiles matching your preferences this week</p>
          </div>
          <div class="body">
            <p>Hi ${name},</p>
            <p>New members have joined TricityShadi this week who match your preferences. Don't miss out!</p>
            ${profilesHtml || ''}
            <div class="cta">
              <a href="${config.server.frontendUrl}/search" class="btn">View All Matches →</a>
            </div>
            <p style="color: #666; font-size: 13px; text-align: center;">Log in to see their full profiles and send interest.</p>
          </div>
          <div class="footer">
            <p>You're receiving this because you have an active profile on TricityShadi.</p>
            <p>© TricityShadi — Chandigarh · Mohali · Panchkula</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, You have ${matchCount} new profiles matching your preferences this week on TricityShadi. Log in to view them: ${config.server.frontendUrl}/search`
  }),

  // One-time verification code (email OTP: signup / email-change).
  otpCode: (code, purpose = 'verify your email') => ({
    subject: 'Your TricityShadi verification code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7c1e3f, #a0294f); color: white; padding: 28px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; text-align: center; }
          .code { font-size: 34px; letter-spacing: 10px; font-weight: bold; color: #7c1e3f; background: #fff; border: 2px solid #7c1e3f; border-radius: 10px; padding: 16px 24px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Verification Code</h1></div>
          <div class="content">
            <p>Use this code to ${purpose}:</p>
            <div class="code">${code}</div>
            <p>This code is valid for 10 minutes. Do not share it with anyone.</p>
            <p style="color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p></div>
        </div>
      </body>
      </html>
    `,
    text: `Your TricityShadi verification code is ${code}. Valid for 10 minutes. Do not share it. If you didn't request this, ignore this email.`
  }),

  // Security alert (new login, password changed, suspicious activity…).
  securityAlert: (name, title, detail, when) => ({
    subject: `Security alert: ${title} - TricityShadi`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #b45309; color: white; padding: 28px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .detail-box { background: #fff; border: 1px solid #e5e5e5; padding: 16px; border-radius: 8px; margin: 18px 0; }
          .button { display: inline-block; background: #7c1e3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 16px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>⚠ ${title}</h1></div>
          <div class="content">
            <p>Hi ${name || 'there'},</p>
            <p>${detail}</p>
            <div class="detail-box">
              ${when ? `<p style="margin:0;"><strong>When:</strong> ${when}</p>` : ''}
              <p style="margin:0;">If this was you, no action is needed.</p>
            </div>
            <p><strong>If this wasn't you</strong>, reset your password immediately and review your active sessions.</p>
            <a href="${config.server.frontendUrl}/settings" class="button">Review Account Security</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
            <p>Questions? Contact ${config.email.support}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name || 'there'}, Security alert: ${title}. ${detail}${when ? ' When: ' + when + '.' : ''} If this wasn't you, reset your password immediately at ${config.server.frontendUrl}/settings.`
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
