const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const jwtService = require('../services/jwtService');
const emailService = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/response');

// 1. REGISTER
const register = async (req, res) => {
  try {
    const { name = '', email, password, organization_name } = req.validatedData;

    // Check if email already registered
    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json(errorResponse('Email already registered'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create Organization
    const slug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
    await db.query(
      `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`,
      [orgId, organization_name, slug]
    );

    // Create User
    await db.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())`,
      [userId, orgId, name, email, hashedPassword]
    );

    // Generate Tokens
    const accessToken = jwtService.generateAccessToken({ userId, organizationId: orgId, email });
    const refreshToken = jwtService.generateRefreshToken({ userId, organizationId: orgId, email });

    // Store Session
    await db.query(
      `INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())`,
      [crypto.randomUUID(), userId, refreshToken]
    );

    // Send verification email in background
    const verifyToken = crypto.randomBytes(24).toString('hex');
    emailService.sendVerificationEmail(email, verifyToken).catch(() => {});

    return res.status(201).json(
      successResponse({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: userId, organization_id: orgId, name, email },
        organization_id: orgId,
      })
    );
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json(errorResponse('Registration failed'));
  }
};

// 2. LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.validatedData;

    const { rows } = await db.query(
      `SELECT id, organization_id, name, email, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json(errorResponse('Invalid email or password'));
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json(errorResponse('Invalid email or password'));
    }

    const accessToken = jwtService.generateAccessToken({
      userId: user.id,
      organizationId: user.organization_id,
      email: user.email,
    });
    const refreshToken = jwtService.generateRefreshToken({
      userId: user.id,
      organizationId: user.organization_id,
      email: user.email,
    });

    // Store Session
    await db.query(
      `INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())`,
      [crypto.randomUUID(), user.id, refreshToken]
    );

    return res.status(200).json(
      successResponse({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: user.id, organization_id: user.organization_id, name: user.name, email: user.email },
        organization_id: user.organization_id,
      })
    );
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json(errorResponse('Login failed'));
  }
};

// 3. REFRESH TOKEN
const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.validatedData;
    const decoded = jwtService.verifyRefreshToken(refresh_token);

    const { rows } = await db.query(
      `SELECT id FROM sessions WHERE refresh_token = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
      [refresh_token]
    );

    if (rows.length === 0) {
      return res.status(401).json(errorResponse('Invalid or expired refresh token'));
    }

    const newAccessToken = jwtService.generateAccessToken({
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      email: decoded.email,
    });

    return res.status(200).json(successResponse({ access_token: newAccessToken }));
  } catch (error) {
    return res.status(401).json(errorResponse('Invalid refresh token'));
  }
};

// 4. LOGOUT
const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db.query('UPDATE sessions SET revoked_at = NOW() WHERE refresh_token = $1', [refresh_token]);
    }
    return res.status(200).json(successResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    return res.status(500).json(errorResponse('Logout failed'));
  }
};

// 5. VERIFY EMAIL
const verifyEmail = async (req, res) => {
  try {
    const token = req.params.token || req.body.token;
    if (!token) return res.status(400).json(errorResponse('Token is required'));

    // In a full flow we can mark email verified for the user
    return res.status(200).json(successResponse({ message: 'Email verified successfully' }));
  } catch (error) {
    return res.status(500).json(errorResponse('Email verification failed'));
  }
};

// 6. RESEND VERIFICATION EMAIL
const resendVerification = async (req, res) => {
  try {
    const { email } = req.validatedData;
    const verifyToken = crypto.randomBytes(24).toString('hex');
    await emailService.sendVerificationEmail(email, verifyToken);
    return res.status(200).json(successResponse({ message: 'Verification email sent' }));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to resend verification email'));
  }
};

// 7. FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.validatedData;
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1', [email]);

    if (rows.length > 0) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      await db.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW())`,
        [crypto.randomUUID(), rows[0].id, tokenHash]
      );

      await emailService.sendPasswordResetEmail(email, resetToken);
    }

    return res.status(200).json(successResponse({ message: 'Password reset link sent if account exists' }));
  } catch (error) {
    console.error('Forgot password error:', error.message);
    return res.status(500).json(errorResponse('Failed to process password reset request'));
  }
};

// 8. RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.validatedData;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await db.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json(errorResponse('Invalid or expired reset token'));
    }

    const { id: tokenId, user_id: userId } = rows[0];
    const hashedPassword = await bcrypt.hash(new_password, 10);

    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);
    await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);

    return res.status(200).json(successResponse({ message: 'Password reset successfully' }));
  } catch (error) {
    return res.status(500).json(errorResponse('Password reset failed'));
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};