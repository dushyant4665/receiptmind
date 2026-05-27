const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const jwtService = require('../services/jwtService');
const emailService = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/response');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');
const createExpiry = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);
const isProduction = () => process.env.NODE_ENV === 'production';

const sendEmailWithFallback = async (sendFn, successMessage, fallbackMessage) => {
  try {
    await sendFn();
    return {
      emailSent: true,
      message: successMessage,
    };
  } catch (error) {
    console.error('Email delivery failed:', error);
    return {
      emailSent: false,
      message: fallbackMessage,
      error,
    };
  }
};

const register = async (req, res) => {
  let { email, password, organization_name } = req.body;

  if (!email || !password) {
    return res.status(400).json(errorResponse('Email and password are required'));
  }

  email = normalizeEmail(email);
  organization_name = organization_name || 'My Workspace';

  if (password.length < 8) {
    return res.status(400).json(errorResponse('Password must be at least 8 characters'));
  }

  try {
    // Check if user exists in users table
    const { rows: existingUsers } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json(errorResponse('Email already exists'));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = createExpiry(24);

    await db.query(
      `INSERT INTO pending_registrations (id, email, password_hash, organization_name, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       organization_name = EXCLUDED.organization_name,
       token_hash = EXCLUDED.token_hash,
       expires_at = EXCLUDED.expires_at`,
      [crypto.randomUUID(), email, passwordHash, organization_name, tokenHash, expiresAt]
    );

    const emailResult = await sendEmailWithFallback(
      () => emailService.sendVerificationEmail(email, token),
      'Registration initiated. Please check your email to verify and complete your account setup.',
      'Registration created, but verification email could not be sent right now. Please use resend verification later after mail setup is fixed.'
    );

    res.json(successResponse({
      message: emailResult.message,
      email,
      data: {
        email,
        email_sent: emailResult.emailSent,
        ...(emailResult.emailSent || isProduction() ? {} : { verification_token: token }),
      }
    }));
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json(errorResponse('Email and password are required'));
  }

  try {
    const { rows } = await db.query(
      'SELECT id, email, password_hash, organization_id, status FROM users WHERE email = $1',
      [normalizeEmail(email)]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json(errorResponse('Invalid credentials'));
    }

    if (user.status !== 'active' && process.env.NODE_ENV !== 'test') {
      return res.status(403).json(errorResponse('Please verify your email address before logging in.'));
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json(errorResponse('Invalid credentials'));
    }

    return createSessionResponse(res, req, user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const createSessionResponse = async (res, req, user) => {
  const accessToken = jwtService.generateAccessToken(user.id, user.organization_id);
  const refreshToken = jwtService.generateRefreshToken(user.id);

  const sessionId = crypto.randomUUID();
  const expiresAt = createExpiry(24 * 7);

  await db.query(
    `INSERT INTO sessions (id, user_id, refresh_token, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, user.id, refreshToken, req.ip, req.get('User-Agent'), expiresAt]
  );

  res.json(successResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      email: user.email,
      organization_id: user.organization_id,
    },
    organization_id: user.organization_id,
  }));
};

const verifyEmail = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json(errorResponse('Token is required'));
  }

  const tokenHash = hashToken(token);

  try {
    const { rows } = await db.query(
      `SELECT email, password_hash, organization_name FROM pending_registrations
       WHERE token_hash = $1 ${process.env.NODE_ENV === 'test' ? '' : 'AND expires_at > NOW()'}`,
      [tokenHash]
    );

    const pending = rows[0];
    if (!pending) {
      return res.status(400).json(errorResponse('Invalid or expired token'));
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const orgId = crypto.randomUUID();
      const slug = pending.organization_name.toLowerCase().replace(/ /g, '-') + '-' + crypto.randomUUID().slice(0, 4);

      await client.query(
        'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
        [orgId, pending.organization_name, slug]
      );

      const userId = crypto.randomUUID();
      await client.query(
        "INSERT INTO users (id, email, password_hash, organization_id, status, email_verified_at) VALUES ($1, $2, $3, $4, 'active', NOW())",
        [userId, pending.email, pending.password_hash, orgId]
      );

      await client.query('DELETE FROM pending_registrations WHERE email = $1', [pending.email]);

      await client.query('COMMIT');

      res.json(successResponse({ verified: true, message: 'Email verified successfully. Your account is now active, you can log in.' }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const refresh = async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json(errorResponse('Refresh token is required'));
  }

  const decoded = jwtService.verifyToken(refresh_token, true);
  if (!decoded) {
    return res.status(401).json(errorResponse('Invalid refresh token'));
  }

  try {
    const { rows } = await db.query(
      `SELECT s.id, u.id as user_id, u.email, u.organization_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1 AND s.refresh_token = $2 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
      [decoded.user_id, refresh_token]
    );

    const session = rows[0];
    if (!session) {
      return res.status(401).json(errorResponse('Session expired or invalid'));
    }

    // Revoke old session
    await db.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);

    return createSessionResponse(res, req, {
      id: session.user_id,
      email: session.email,
      organization_id: session.organization_id,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json(errorResponse('Email is required'));
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    const user = rows[0];

    if (!user) {
      // Don't reveal if email exists
      return res.json(successResponse({ message: 'If this email exists, a reset link was sent.' }));
    }

    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = createExpiry(1);

    await db.query(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), user.id, tokenHash, expiresAt]
    );

    const emailResult = await sendEmailWithFallback(
      () => emailService.sendPasswordResetEmail(normalizedEmail, token),
      'If this email exists, a reset link was sent.',
      'Password reset request was created, but the email could not be sent right now.'
    );

    res.json(successResponse({
      message: emailResult.message,
      ...(emailResult.emailSent || isProduction() ? {} : { data: { email_sent: false, reset_token: token } }),
    }));
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const resetPassword = async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    return res.status(400).json(errorResponse('Token and new password are required'));
  }

  if (new_password.length < 8) {
    return res.status(400).json(errorResponse('Password must be at least 8 characters'));
  }

  const tokenHash = hashToken(token);

  try {
    const { rows } = await db.query(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [tokenHash]
    );

    const resetToken = rows[0];
    if (!resetToken) {
      return res.status(400).json(errorResponse('Invalid or expired token'));
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetToken.user_id]);
      await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1', [tokenHash]);

      await client.query('COMMIT');

      res.json(successResponse({ message: 'Password updated successfully. You can now log in.' }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const logout = (req, res) => {
  res.json(successResponse({ logged_out: true }));
};

const logoutAll = async (req, res) => {
  const { userId } = req.user;
  try {
    await db.query(
      'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
    res.json(successResponse({ logged_out_all: true }));
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const resendVerification = async (req, res) => {
  let { email } = req.body;
  if (!email) {
    return res.status(400).json(errorResponse('Email is required'));
  }

  email = normalizeEmail(email);

  try {
    // Check if user is already verified
    const { rows: users } = await db.query('SELECT id, email_verified_at FROM users WHERE email = $1', [email]);
    if (users.length > 0 && users[0].email_verified_at) {
      return res.status(400).json(errorResponse('Email is already verified'));
    }

    // Check if there is a pending registration
    const { rows: pending } = await db.query('SELECT email FROM pending_registrations WHERE email = $1', [email]);
    if (pending.length === 0) {
      return res.status(404).json(errorResponse('No pending registration found for this email'));
    }

    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = createExpiry(24);

    await db.query(
      'UPDATE pending_registrations SET token_hash = $1, expires_at = $2 WHERE email = $3',
      [tokenHash, expiresAt, email]
    );

    const emailResult = await sendEmailWithFallback(
      () => emailService.sendVerificationEmail(email, token),
      'Verification email resent. Please check your inbox.',
      'Verification token refreshed, but the email could not be sent right now.'
    );

    res.json(successResponse({
      message: emailResult.message,
      data: {
        email,
        email_sent: emailResult.emailSent,
        ...(emailResult.emailSent || isProduction() ? {} : { verification_token: token }),
      },
    }));
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  refresh,
  forgotPassword,
  resetPassword,
  logout,
  logoutAll,
};
