/**
 * Email Utility
 * Handles email sending with templates
 */

const nodemailer = require('nodemailer');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

// Create transporter
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
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
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
            <p>Please re-submit your verification documents ensuring they are:</p>
            <ul>
              <li>Clear and legible</li>
              <li>Valid and not expired</li>
              <li>Matching the information on your profile</li>
            </ul>
            <a href="${config.server.frontendUrl}/settings" class="button">Re-submit Verification</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TricityShadi. All rights reserved.</p>
            <p>If you have questions, contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, Your verification was not approved.${reason ? ' Reason: ' + reason : ''} Please re-submit with clear, valid documents.`
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
};

// Send email function
const sendEmail = async (to, template, data = {}) => {
  try {
    if (!config.email.host || !config.email.user) {
      log.warn('Email not configured, skipping send', { to, template: typeof template === 'string' ? template : 'custom' });
      return { success: false, reason: 'Email not configured' };
    }

    let emailContent;
    
    if (typeof template === 'string' && templates[template]) {
      // Use predefined template
      emailContent = templates[template](...Object.values(data));
    } else if (typeof template === 'object') {
      // Custom template object
      emailContent = template;
    } else {
      throw new Error(`Invalid email template: ${template}`);
    }

    const mailOptions = {
      from: `"TricityShadi" <${config.email.from || config.email.user}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    const info = await getTransporter().sendMail(mailOptions);
    
    log.info('Email sent successfully', { 
      to, 
      subject: emailContent.subject,
      messageId: info.messageId 
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    log.error('Failed to send email', { 
      error: error.message, 
      to, 
      template: typeof template === 'string' ? template : 'custom' 
    });
    
    // Don't throw, just return failure
    return { success: false, error: error.message };
  }
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

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendMatchNotification,
  sendSubscriptionConfirmation,
  sendVerificationApproved,
  sendVerificationRejected,
  sendWeeklyDigest,
  templates,
};
