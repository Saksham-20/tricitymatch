const nodemailer = require('nodemailer');
const config = require('../config/env');

// Create transporter based on environment
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.password
    }
  });
};

const sendEmail = async (to, subject, html, text) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    const info = await transporter.sendMail(mailOptions);

    if (config.isDevelopment) {
      console.log('Email sent:', info.messageId);
      if (info.response && info.response.includes('ethereal')) {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

const sendMatchNotification = async (userEmail, matchedUserName, profileUrl) => {
  const subject = 'New Match Found! ❤️';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e91e63;">You have a new match!</h2>
      <p>Hi there,</p>
      <p>Great news! <strong>${matchedUserName}</strong> has liked your profile.</p>
      <p>Check out their profile and start a conversation!</p>
      <a href="${profileUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e91e63; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">View Profile</a>
      <p>Best regards,<br>TricityShadi Team</p>
    </div>
  `;
  return await sendEmail(userEmail, subject, html);
};

const sendMessageNotification = async (userEmail, senderName, messagePreview) => {
  const subject = 'New Message from ' + senderName;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e91e63;">You have a new message!</h2>
      <p>Hi there,</p>
      <p><strong>${senderName}</strong> sent you a message:</p>
      <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-style: italic;">"${messagePreview}"</p>
      <p>Log in to reply!</p>
      <p>Best regards,<br>TricityShadi Team</p>
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
      <p>Best regards,<br>TricityShadi Team</p>
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

