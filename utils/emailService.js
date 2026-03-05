const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not regular password)
  },
});

/**
 * Send OTP email to user
 * @param {string} email - Recipient email address
 * @param {string} otp - 5-digit OTP code
 * @returns {Promise<Object>} - Email sending result
 */
async function sendOTPEmail(email, otp) {
  try {
    const mailOptions = {
      from: `"Dinewell" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset OTP - Dinewell',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #F6BD87 0%, #FFF6ED 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: #000000; margin: 0 0 20px 0;">Password Reset Request</h1>
            <p style="color: #000000; font-size: 16px; margin: 0 0 30px 0;">
              You have requested to reset your password. Please use the OTP code below:
            </p>
            <div style="background: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #EF7013; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: 700;">
                ${otp}
              </h2>
            </div>
            <p style="color: #000000; font-size: 14px; margin: 20px 0 0 0;">
              This OTP will expire in 10 minutes.
            </p>
            <p style="color: #000000; font-size: 12px; margin: 20px 0 0 0;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
          <p style="color: #8B8B9A; font-size: 12px; text-align: center; margin-top: 20px;">
            © ${new Date().getFullYear()} Dinewell. All rights reserved.
          </p>
        </div>
      `,
      text: `Your password reset OTP is: ${otp}. This OTP will expire in 10 minutes.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
}

module.exports = {
  sendOTPEmail,
};
