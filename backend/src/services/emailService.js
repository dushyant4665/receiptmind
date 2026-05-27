const nodemailer = require('nodemailer');
require('dotenv').config();

const cleanEnv = (value) => {
  if (!value) return '';
  return String(value).replace(/["']/g, '').trim();
};

const parsePort = (value, fallback) => {
  const parsed = parseInt(String(value || ''), 10);
  return isNaN(parsed) ? fallback : parsed;
};

const getSmtpConfig = () => {
  const host = cleanEnv(process.env.SMTP_HOST);
  const port = parsePort(process.env.SMTP_PORT, 587);
  const user = cleanEnv(process.env.SMTP_USER);
  const pass = cleanEnv(process.env.SMTP_PASS);
  const from = cleanEnv(process.env.SMTP_FROM) || user;

  return { host, port, user, pass, from };
};

const createTransporter = () => {
  const config = getSmtpConfig();

  if (!config.host || !config.user || !config.pass) {
    console.error('Email configuration missing:', { 
      host: !!config.host, 
      user: !!config.user, 
      pass: !!config.pass 
    });
    throw new Error('Email service is not configured. Please check SMTP environment variables.');
  }

  const isGmail = config.host.includes('gmail.com');
  
  const transportOptions = isGmail ? {
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass,
    },
  } : {
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  return nodemailer.createTransport(transportOptions);
};

const getEmailTemplate = (title, message, url, buttonText) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #09090b; margin: 0; padding: 0; background-color: #fafafa; }
    .container { max-width: 480px; margin: 40px auto; padding: 0; border-radius: 12px; overflow: hidden; border: 1px solid #e4e4e7; background-color: #ffffff; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.03); }
    .content { padding: 40px 40px 10px; text-align: left; }
    .logo { font-size: 20px; font-weight: 600; letter-spacing: -0.025em; margin-bottom: 30px; color: #09090b; }
    .content h2 { margin-top: 0; color: #09090b; font-size: 18px; font-weight: 600; }
    .content p { color: #71717a; font-size: 14px; margin-bottom: 24px; line-height: 24px; }
    .button { display: inline-block; padding: 10px 18px; background-color: #09090b; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; }
    .footer { padding: 10px 40px 40px; font-size: 13px; color: #a1a1aa; text-align: left; background-color: #ffffff; }
    .link-alt { margin-top: 32px; font-size: 13px; color: #71717a; word-break: break-all; padding-top: 24px; border-top: 1px solid #f0f0f2; }
    .link-alt a { color: #09090b; text-decoration: underline; text-underline-offset: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="logo">ReceiptMind</div>
      <h2>${title}</h2>
      <p>${message}</p>
      <a href="${url}" class="button">${buttonText}</a>
      <div class="link-alt">
        <p style="margin-bottom: 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <a href="${url}">${url}</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} ReceiptMind. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};

const sendEmail = async (to, subject, html) => {
  const config = getSmtpConfig();
  const transporter = createTransporter();

  try {
    const mailOptions = {
      from: config.from.includes('<') ? config.from : `ReceiptMind <${config.from}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email service error:', error.message);
    if (error.code === 'EAUTH') {
      console.error('SMTP Authentication failed. Check user/password (App Password might be required for Gmail).');
    }
    throw error;
  }
};

const sendVerificationEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
  
  const title = 'Welcome to ReceiptMind';
  const message = 'Thank you for signing up! Please verify your email address to activate your account and start managing your receipts efficiently.';
  const buttonText = 'Verify Email Address';
  
  const html = getEmailTemplate(title, message, verificationUrl, buttonText);
  
  return sendEmail(email, 'Verify your email - ReceiptMind', html);
};

const sendPasswordResetEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  
  const title = 'Password Reset Request';
  const message = 'We received a request to reset your password. If you didn\'t make this request, you can safely ignore this email. Otherwise, click the button below to set a new password.';
  const buttonText = 'Reset Password';
  
  const html = getEmailTemplate(title, message, resetUrl, buttonText);
  
  return sendEmail(email, 'Reset your password - ReceiptMind', html);
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};


