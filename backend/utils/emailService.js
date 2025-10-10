const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create transporter
const createTransporter = () => {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    console.warn('Email configuration not found. Email service will not work.');
    return null;
  }

  return nodemailer.createTransporter({
    host: config.email.host,
    port: config.email.port,
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.pass
    }
  });
};

// Send email
const sendEmail = async (to, subject, html, text) => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.log('Email service not configured. Would send:', { to, subject, html });
      return { success: true, message: 'Email service not configured' };
    }

    const mailOptions = {
      from: `"Tricity Match" <${config.email.user}>`,
      to,
      subject,
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email
const sendWelcomeEmail = async (userEmail, userName) => {
  const subject = 'Welcome to Tricity Match! ❤️';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #FFE5D9 0%, #E0BBE4 100%); padding: 40px; text-align: center; border-radius: 10px;">
        <h1 style="color: #333; margin-bottom: 20px;">Welcome to Tricity Match! ❤️</h1>
        <p style="color: #666; font-size: 18px; margin-bottom: 30px;">Hi ${userName},</p>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          We're excited to have you join our community! Your journey to find your perfect match in Tricity starts here.
        </p>
        <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 20px;">Next Steps:</h3>
          <ul style="text-align: left; color: #666; line-height: 1.8;">
            <li>Complete your profile to get better matches</li>
            <li>Upload your best photos</li>
            <li>Set your partner preferences</li>
            <li>Start browsing and connecting!</li>
          </ul>
        </div>
        <p style="color: #666; margin-top: 30px;">
          Happy matching!<br>
          The Tricity Match Team
        </p>
      </div>
    </div>
  `;

  return await sendEmail(userEmail, subject, html);
};

// Send match notification email
const sendMatchNotificationEmail = async (userEmail, userName, matchName) => {
  const subject = `New Match Found! ${matchName} liked your profile ❤️`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #FFE5D9 0%, #E0BBE4 100%); padding: 40px; text-align: center; border-radius: 10px;">
        <h1 style="color: #333; margin-bottom: 20px;">New Match Found! ❤️</h1>
        <p style="color: #666; font-size: 18px; margin-bottom: 30px;">Hi ${userName},</p>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          Great news! <strong>${matchName}</strong> has liked your profile. This could be the beginning of something beautiful!
        </p>
        <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 20px;">What's Next?</h3>
          <ul style="text-align: left; color: #666; line-height: 1.8;">
            <li>View their profile and see if you're interested</li>
            <li>Like them back to create a mutual match</li>
            <li>Start a conversation if you're both interested</li>
          </ul>
        </div>
        <p style="color: #666; margin-top: 30px;">
          Don't wait too long - great matches don't last forever!<br>
          The Tricity Match Team
        </p>
      </div>
    </div>
  `;

  return await sendEmail(userEmail, subject, html);
};

// Send subscription expiry reminder
const sendSubscriptionExpiryEmail = async (userEmail, userName, subscriptionType, daysLeft) => {
  const subject = `Your ${subscriptionType} subscription expires in ${daysLeft} days`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #FFE5D9 0%, #E0BBE4 100%); padding: 40px; text-align: center; border-radius: 10px;">
        <h1 style="color: #333; margin-bottom: 20px;">Subscription Reminder</h1>
        <p style="color: #666; font-size: 18px; margin-bottom: 30px;">Hi ${userName},</p>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          Your <strong>${subscriptionType}</strong> subscription will expire in <strong>${daysLeft} days</strong>.
        </p>
        <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 20px;">Don't Miss Out!</h3>
          <p style="color: #666; line-height: 1.6;">
            Renew your subscription to continue enjoying premium features like unlimited browsing, 
            chat with matches, and seeing who liked your profile.
          </p>
        </div>
        <p style="color: #666; margin-top: 30px;">
          Renew now to keep your premium experience!<br>
          The Tricity Match Team
        </p>
      </div>
    </div>
  `;

  return await sendEmail(userEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendMatchNotificationEmail,
  sendSubscriptionExpiryEmail
};
