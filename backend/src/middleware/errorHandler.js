const {
  errorResponse,
} = require('../utils/response');

/*
  =====================================
  GLOBAL ERROR HANDLER
  =====================================
*/

const errorHandler = (
  err,
  req,
  res,
  next
) => {

  console.error(
    'Global Error:',
    err.message
  );

  /*
    =================================
    MULTER ERRORS
    =================================
  */

  if (
    err.code === 'LIMIT_FILE_SIZE'
  ) {

    return res
      .status(400)
      .json(
        errorResponse(
          'File too large. Max size is 10MB.'
        )
      );
  }

  /*
    =================================
    INVALID FILE TYPE
    =================================
  */

  if (
    err.message ===
    'Unsupported file type'
  ) {

    return res
      .status(400)
      .json(
        errorResponse(
          'Unsupported file format'
        )
      );
  }

  /*
    =================================
    JWT ERRORS
    =================================
  */

  if (
    err.name ===
    'JsonWebTokenError'
  ) {

    return res
      .status(401)
      .json(
        errorResponse(
          'Invalid token'
        )
      );
  }

  /*
    =================================
    TOKEN EXPIRED
    =================================
  */

  if (
    err.name ===
    'TokenExpiredError'
  ) {

    return res
      .status(401)
      .json(
        errorResponse(
          'Token expired'
        )
      );
  }

  /*
    =================================
    DATABASE ERRORS
    =================================
  */

  if (
    err.code === '23505'
  ) {

    return res
      .status(409)
      .json(
        errorResponse(
          'Duplicate record detected'
        )
      );
  }

  /*
    =================================
    DEFAULT ERROR
    =================================
  */

  return res
    .status(500)
    .json(
      errorResponse(
        process.env.NODE_ENV ===
        'production'
          ? 'Internal server error'
          : err.message
      )
    );
};

module.exports =
  errorHandler;