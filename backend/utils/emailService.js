const config = require('../config/env');
// Legacy service (match/chat/subscription notices). Delegates delivery to the
// primary email util so everything ships through Resend (or SMTP fallback).
const { sendEmail: deliverEmail } = require('./email');

const sendEmail = async (to, subject, html, text) => {
  return deliverEmail(to, {
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
  });
};

// Mutual-match mail. Uses the branded, escaped template in utils/email.js (the
// old inline pink one interpolated the name unescaped and carried no footer).
// `profileUrl` is kept for call-site compatibility; the template links to /matches.
const sendMatchNotification = async (userEmail, matchedUserName, profileUrl, recipientName) => {
  if (!userEmail) return false;
  const { sendMatchNotification: send } = require('./email');
  return send(userEmail, recipientName || 'there', matchedUserName);
};

// messageNotice is a safe, non-private string like "You have a new message" — never pass raw message content here.
const sendMessageNotification = async (userEmail, senderName, messageNotice) => {
  const subject = 'New Message from ' + senderName;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e91e63;">You have a new message!</h2>
      <p>Hi there,</p>
      <p><strong>${senderName}</strong> sent you a message. Log in to read it.</p>
      <p>Best regards,<br>TricityMatch Team</p>
    </div>
  `;
  return await sendEmail(userEmail, subject, html);
};

const sendSubscriptionReminder = async (userEmail, planType, daysLeft) => {
  const subject = `Your ${planType} subscription expires in ${daysLeft} days`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e91e63;">Subscription Reminder</h2>
      <p>Hi there,</p>
      <p>Your <strong>${planType}</strong> subscription will expire in <strong>${daysLeft} days</strong>.</p>
      <p>Renew now to continue enjoying premium features!</p>
      <a href="${config.server.frontendUrl}/subscription" style="display: inline-block; padding: 12px 24px; background-color: #e91e63; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Renew Subscription</a>
      <p>Best regards,<br>TricityMatch Team</p>
    </div>
  `;
  return await sendEmail(userEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendMatchNotification,
  sendMessageNotification,
  sendSubscriptionReminder
};

