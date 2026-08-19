require('dotenv').config();
const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'receiptmind-access-secret-fallback';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'receiptmind-refresh-secret-fallback';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRATION || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRATION || '7d';

const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      organizationId: payload.organizationId,
      email: payload.email,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
};

const generateRefreshToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      organizationId: payload.organizationId,
      email: payload.email,
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};