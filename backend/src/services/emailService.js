require('dotenv').config();
const https = require('https');

const getBrevoConfig = () => ({
  apiKey: (process.env.BREVO_API_KEY || '').trim(),
  from: (process.env.BREVO_FROM || 'ReceiptMind <no-reply@receiptmind.com>').trim(),
});

const parseEmailAddress = (value) => {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) return { email: value };
  return { name: match[1].trim(), email: match[2].trim() };
};

const sendEmail = async (to, subject, html) => {
  const { apiKey, from } = getBrevoConfig();

  // If no API key configured in development, log to console safely
  if (!apiKey) {
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  const payload = JSON.stringify({
    sender: parseEmailAddress(from),
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: body });
          } else {
            console.error('Brevo API Error:', res.statusCode, body);
            resolve({ success: false, error: body });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('Brevo Request Error:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
};

const sendVerificationEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const html = `
    <h2>Welcome to ReceiptMind</h2>
    <p>Please click below to verify your email address:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
    <p>Or paste this link: ${verifyUrl}</p>
  `;
  return sendEmail(email, 'Verify your ReceiptMind Account', html);
};

const sendPasswordResetEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  const html = `
    <h2>Reset Your Password</h2>
    <p>You requested to reset your password. Click below to proceed:</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
    <p>If you did not make this request, you can ignore this email.</p>
  `;
  return sendEmail(email, 'ReceiptMind Password Reset', html);
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
