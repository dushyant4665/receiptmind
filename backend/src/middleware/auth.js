const jwtService = require('../services/jwtService');
const db = require('../config/db');
const { errorResponse } = require('../utils/response');

// Verifies Bearer JWT token and attaches req.user
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('Authorization header missing or invalid'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwtService.verifyAccessToken(token);

    const { rows } = await db.query(
      'SELECT id, organization_id, name, email FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json(errorResponse('User not found'));
    }

    const user = rows[0];
    req.user = {
      userId: user.id,
      organizationId: user.organization_id,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    return res.status(401).json(errorResponse('Invalid or expired token'));
  }
};

module.exports = authenticate;