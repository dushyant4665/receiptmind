const crypto =
  require('crypto');

const bcrypt =
  require('bcryptjs');

const db =
  require('../config/db');

const jwtService =
  require('../services/jwtService');

const {
  successResponse,
  errorResponse,
} = require('../utils/response');

/*
  =====================================
  REGISTER
  =====================================
*/

const register = async (
  req,
  res
) => {

  try {

    const {

      name,

      email,

      password,

      organization_name,

    } = req.validatedData;

    /*
      ================================
      CHECK EXISTING USER
      ================================
    */

    const existingUser =
      await db.query(
        `
          SELECT id
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email]
      );

    if (
      existingUser.rows.length > 0
    ) {

      return res
        .status(409)
        .json(
          errorResponse(
            'Email already registered'
          )
        );
    }

    /*
      ================================
      HASH PASSWORD
      ================================
    */

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    /*
      ================================
      IDS
      ================================
    */

    const organizationId =
      crypto.randomUUID();

    const userId =
      crypto.randomUUID();

    /*
      ================================
      CREATE ORGANIZATION
      ================================
    */

    await db.query(
      `
        INSERT INTO organizations (
          id,
          name,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          NOW(),
          NOW()
        )
      `,
      [
        organizationId,
        organization_name,
      ]
    );

    /*
      ================================
      CREATE USER
      ================================
    */

    await db.query(
      `
        INSERT INTO users (

          id,
          organization_id,

          name,
          email,
          password_hash,

          created_at,
          updated_at

        )
        VALUES (

          $1,
          $2,

          $3,
          $4,
          $5,

          NOW(),
          NOW()
        )
      `,
      [

        userId,

        organizationId,

        name,

        email,

        hashedPassword,
      ]
    );

    /*
      ================================
      TOKENS
      ================================
    */

    const accessToken =
      jwtService.generateAccessToken({

        userId,

        organizationId,

        email,
      });

    const refreshToken =
      jwtService.generateRefreshToken({

        userId,

        organizationId,

        email,
      });

    /*
      ================================
      STORE SESSION
      ================================
    */

    await db.query(
      `
        INSERT INTO sessions (

          id,
          user_id,
          refresh_token,

          created_at,
          updated_at

        )
        VALUES (

          gen_random_uuid(),
          $1,
          $2,

          NOW(),
          NOW()
        )
      `,
      [
        userId,
        refreshToken,
      ]
    );

    /*
      ================================
      RESPONSE
      ================================
    */

    return res
      .status(201)
      .json(
        successResponse({

          access_token:
            accessToken,

          refresh_token:
            refreshToken,

          user: {

            id: userId,

            organization_id:
              organizationId,

            name,

            email,
          },
        })
      );

  } catch (error) {

    console.error(
      'Register Error:',
      error.message
    );

    return res
      .status(500)
      .json(
        errorResponse(
          'Registration failed'
        )
      );
  }
};

/*
  =====================================
  LOGIN
  =====================================
*/

const login = async (
  req,
  res
) => {

  try {

    const {
      email,
      password,
    } = req.validatedData;

    /*
      ================================
      FIND USER
      ================================
    */

    const result =
      await db.query(
        `
          SELECT *
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email]
      );

    if (
      result.rows.length === 0
    ) {

      return res
        .status(401)
        .json(
          errorResponse(
            'Invalid credentials'
          )
        );
    }

    const user =
      result.rows[0];

    /*
      ================================
      VERIFY PASSWORD
      ================================
    */

    const validPassword =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!validPassword) {

      return res
        .status(401)
        .json(
          errorResponse(
            'Invalid credentials'
          )
        );
    }

    /*
      ================================
      TOKENS
      ================================
    */

    const accessToken =
      jwtService.generateAccessToken({

        userId:
          user.id,

        organizationId:
          user.organization_id,

        email:
          user.email,
      });

    const refreshToken =
      jwtService.generateRefreshToken({

        userId:
          user.id,

        organizationId:
          user.organization_id,

        email:
          user.email,
      });

    /*
      ================================
      SAVE SESSION
      ================================
    */

    await db.query(
      `
        INSERT INTO sessions (

          id,
          user_id,
          refresh_token,

          created_at,
          updated_at

        )
        VALUES (

          gen_random_uuid(),
          $1,
          $2,

          NOW(),
          NOW()
        )
      `,
      [
        user.id,
        refreshToken,
      ]
    );

    /*
      ================================
      RESPONSE
      ================================
    */

    return res
      .status(200)
      .json(
        successResponse({

          access_token:
            accessToken,

          refresh_token:
            refreshToken,

          user: {

            id:
              user.id,

            organization_id:
              user.organization_id,

            name:
              user.name,

            email:
              user.email,
          },
        })
      );

  } catch (error) {

    console.error(
      'Login Error:',
      error.message
    );

    return res
      .status(500)
      .json(
        errorResponse(
          'Login failed'
        )
      );
  }
};

/*
  =====================================
  REFRESH TOKEN
  =====================================
*/

const refreshToken = async (
  req,
  res
) => {

  try {

    const {
      refresh_token,
    } = req.validatedData;

    /*
      ================================
      VERIFY TOKEN
      ================================
    */

    const decoded =
      jwtService.verifyRefreshToken(
        refresh_token
      );

    /*
      ================================
      CHECK SESSION
      ================================
    */

    const session =
      await db.query(
        `
          SELECT id
          FROM sessions
          WHERE refresh_token = $1
          LIMIT 1
        `,
        [refresh_token]
      );

    if (
      session.rows.length === 0
    ) {

      return res
        .status(401)
        .json(
          errorResponse(
            'Invalid session'
          )
        );
    }

    /*
      ================================
      GENERATE NEW ACCESS TOKEN
      ================================
    */

    const accessToken =
      jwtService.generateAccessToken({

        userId:
          decoded.userId,

        organizationId:
          decoded.organizationId,

        email:
          decoded.email,
      });

    return res
      .status(200)
      .json(
        successResponse({

          access_token:
            accessToken,
        })
      );

  } catch (error) {

    console.error(
      'Refresh Error:',
      error.message
    );

    return res
      .status(401)
      .json(
        errorResponse(
          'Invalid refresh token'
        )
      );
  }
};

/*
  =====================================
  LOGOUT
  =====================================
*/

const logout = async (
  req,
  res
) => {

  try {

    const {
      refresh_token,
    } = req.body;

    if (refresh_token) {

      await db.query(
        `
          DELETE FROM sessions
          WHERE refresh_token = $1
        `,
        [refresh_token]
      );
    }

    return res
      .status(200)
      .json(
        successResponse({
          message:
            'Logged out successfully',
        })
      );

  } catch (error) {

    console.error(
      'Logout Error:',
      error.message
    );

    return res
      .status(500)
      .json(
        errorResponse(
          'Logout failed'
        )
      );
  }
};

module.exports = {

  register,

  login,

  refreshToken,

  logout,
};