const { errorResponse } = require('../utils/response');

// Centralized Express error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err.message || err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(errorResponse('File too large. Max size is 10MB.'));
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json(errorResponse('Invalid or expired token'));
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json(errorResponse('Duplicate record detected'));
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message || 'Something went wrong';

  return res.status(statusCode).json(errorResponse(message));
};

module.exports = errorHandler;