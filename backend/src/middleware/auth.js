const jwtService =
  require('../services/jwtService');

const db =
  require('../config/db');

const {
  errorResponse,
} = require('../utils/response');

/*
  =====================================
  AUTH MIDDLEWARE
  =====================================
*/

const authenticate = async (
  req,
  res,
  next
) => {

  try {

    /*
      ================================
      AUTH HEADER
      ================================
    */

    const authHeader =
      req.headers.authorization;

    if (!authHeader) {

      return res
        .status(401)
        .json(
          errorResponse(
            'Authorization header missing'
          )
        );
    }

    /*
      ================================
      BEARER TOKEN
      ================================
    */

    const token =
      authHeader.startsWith(
        'Bearer '
      )
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {

      return res
        .status(401)
        .json(
          errorResponse(
            'Invalid authorization format'
          )
        );
    }

    /*
      ================================
      VERIFY TOKEN
      ================================
    */

    const decoded =
      jwtService.verifyAccessToken(
        token
      );

    /*
      ================================
      FETCH USER
      ================================
    */

    const result =
      await db.query(
        `
          SELECT
            id,
            organization_id,
            name,
            email
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [
          decoded.userId,
        ]
      );

    if (
      result.rows.length === 0
    ) {

      return res
        .status(401)
        .json(
          errorResponse(
            'User not found'
          )
        );
    }

    const user =
      result.rows[0];

    /*
      ================================
      ATTACH USER
      ================================
    */

    req.user = {

      userId:
        user.id,

      organizationId:
        user.organization_id,

      name:
        user.name,

      email:
        user.email,
    };

    next();

  } catch (error) {

    console.error(
      'Auth Middleware Error:',
      error.message
    );

    return res
      .status(401)
      .json(
        errorResponse(
          'Unauthorized'
        )
      );
  }
};

module.exports =
  authenticate;