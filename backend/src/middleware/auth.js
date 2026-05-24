const jwtService = require('../services/jwtService');
const { errorResponse } = require('../utils/response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('No token provided'));
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwtService.verifyToken(token);

  if (!decoded) {
    return res.status(401).json(errorResponse('Invalid or expired token'));
  }

  req.user = {
    userId: decoded.user_id,
    organizationId: decoded.organization_id
  };
  next();
};

module.exports = authenticate;
