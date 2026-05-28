const dns = require('dns');
const nodemailer = require('nodemailer');
require('dotenv').config();

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const cleanEnv = (value) => String(value || '').replace(/["']/g, '').trim();

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const parseHost = (value) => {
  const host = cleanEnv(value);
  if (!host) return '';
  return host.replace(/^smtps?:\/\//i, '').replace(/:\d+$/, '');
};

const getSmtpConfig = () => ({
  host: parseHost(process.env.SMTP_HOST),
  port: parsePort(process.env.SMTP_PORT, 587),
  user: cleanEnv(process.env.SMTP_USER),
  pass: cleanEnv(process.env.SMTP_PASS),
  from: cleanEnv(process.env.SMTP_FROM),
  secure: parseBoolean(process.env.SMTP_SECURE, false),
});

const buildTransporter = () => {
  const config = getSmtpConfig();

  if (!config.host || !config.user || !config.pass) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  const secure = config.port === 465 ? true : config.secure;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    family: 4,
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4, all: false }, callback);
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      servername: config.host,
    },
  });
};

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = buildTransporter();
  }
  return transporter;
};

const resetTransporter = () => {
  transporter = undefined;
};

const getEmailTemplate = (title, message, url, buttonText) => `
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

const sendEmail = async (to, subject, html) => {
  const config = getSmtpConfig();
  const from = config.from || config.user;
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: from.includes('<') ? from : `ReceiptMind <${from}>`,
      to,
      subject,
      html,
    });

    console.log(`Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Email delivery failed:', error);
    if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(error.code) || /timeout/i.test(error.message || '')) {
      resetTransporter();
    }
    throw error;
  }
};

const sendVerificationEmail = async (email, token) => {
  const frontendUrl = cleanEnv(process.env.FRONTEND_URL) || 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  return sendEmail(
    email,
    'Verify your email - ReceiptMind',
    getEmailTemplate(
      'Welcome to ReceiptMind',
      'Thank you for signing up! Please verify your email address to activate your account and start managing your receipts efficiently.',
      verificationUrl,
      'Verify Email Address'
    )
  );
};

const sendPasswordResetEmail = async (email, token) => {
  const frontendUrl = cleanEnv(process.env.FRONTEND_URL) || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  return sendEmail(
    email,
    'Reset your password - ReceiptMind',
    getEmailTemplate(
      'Password Reset Request',
      "We received a request to reset your password. If you didn't make this request, you can safely ignore this email. Otherwise, click the button below to set a new password.",
      resetUrl,
      'Reset Password'
    )
  );
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
