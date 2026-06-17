const jwt =
  require('jsonwebtoken');

require('dotenv').config();

/*
  =====================================
  ENV
  =====================================
*/

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET;

const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET;

if (
  !ACCESS_SECRET ||
  !REFRESH_SECRET
) {

  throw new Error(
    'JWT secrets missing'
  );
}

/*
  =====================================
  ACCESS TOKEN
  =====================================
*/

const generateAccessToken = (
  payload
) => {

  return jwt.sign(

    {
      userId:
        payload.userId,

      organizationId:
        payload.organizationId,

      email:
        payload.email,
    },

    ACCESS_SECRET,

    {
      expiresIn: '15m',
    }
  );
};

/*
  =====================================
  REFRESH TOKEN
  =====================================
*/

const generateRefreshToken = (
  payload
) => {

  return jwt.sign(

    {
      userId:
        payload.userId,

      organizationId:
        payload.organizationId,

      email:
        payload.email,
    },

    REFRESH_SECRET,

    {
      expiresIn: '7d',
    }
  );
};

/*
  =====================================
  VERIFY ACCESS TOKEN
  =====================================
*/

const verifyAccessToken = (
  token
) => {

  return jwt.verify(
    token,
    ACCESS_SECRET
  );
};

/*
  =====================================
  VERIFY REFRESH TOKEN
  =====================================
*/

const verifyRefreshToken = (
  token
) => {

  return jwt.verify(
    token,
    REFRESH_SECRET
  );
};

module.exports = {

  generateAccessToken,

  generateRefreshToken,

  verifyAccessToken,

  verifyRefreshToken,
};