const dns = require('dns');
const https = require('https');
require('dotenv').config();

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const cleanEnv = (value) => String(value || '').replace(/["']/g, '').trim();

const getBrevoConfig = () => ({
  apiKey: cleanEnv(process.env.BREVO_API_KEY),
  from: cleanEnv(process.env.BREVO_FROM),
});

const parseEmailAddress = (value) => {
  const cleaned = cleanEnv(value);
  const match = cleaned.match(/^(.*)<([^>]+)>$/);

  if (!match) {
    return { email: cleaned };
  }

  return {
    name: match[1].trim(),
    email: match[2].trim(),
  };
};

const sendWithBrevoApi = async ({ to, subject, html, from, apiKey }) => {
  const payload = JSON.stringify({
    sender: parseEmailAddress(from),
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      family: 4,
      timeout: 15000,
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { ...options, family: 4, all: false }, callback);
      },
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Brevo API error ${response.statusCode}: ${body}`));
          return;
        }

        resolve({
          messageId: `brevo-api:${Date.now()}`,
          response: body,
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Brevo API request timed out'));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
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
  const config = getBrevoConfig();

  if (!config.apiKey) {
    throw new Error('BREVO_API_KEY is required.');
  }

  if (!config.from) {
    throw new Error('BREVO_FROM is required.');
  }

  const info = await sendWithBrevoApi({
    to,
    subject,
    html,
    from: config.from,
    apiKey: config.apiKey,
  });

  console.log(`Email sent successfully via Brevo API: ${info.messageId}`);
  return info;
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
