const {
  z,
} = require('zod');

/*
  =====================================
  REGISTER VALIDATION
  =====================================
*/

const registerSchema =
  z.object({

    name:
      z.string({

        required_error:
          'Name is required',
      })
      .min(
        2,
        'Name too short'
      )
      .max(
        100,
        'Name too long'
      ),

    email:
      z.string({

        required_error:
          'Email is required',
      })
      .email(
        'Invalid email'
      ),

    password:
      z.string({

        required_error:
          'Password is required',
      })
      .min(
        8,
        'Password must be at least 8 characters'
      )
      .max(
        100,
        'Password too long'
      ),

    organization_name:
      z.string({

        required_error:
          'Organization name is required',
      })
      .min(
        2,
        'Organization name too short'
      )
      .max(
        150,
        'Organization name too long'
      ),
  });

/*
  =====================================
  LOGIN VALIDATION
  =====================================
*/

const loginSchema =
  z.object({

    email:
      z.string({

        required_error:
          'Email is required',
      })
      .email(
        'Invalid email'
      ),

    password:
      z.string({

        required_error:
          'Password is required',
      })
      .min(
        1,
        'Password is required'
      ),
  });

/*
  =====================================
  REFRESH TOKEN VALIDATION
  =====================================
*/

const refreshTokenSchema =
  z.object({

    refresh_token:
      z.string({

        required_error:
          'Refresh token required',
      })
      .min(
        10,
        'Invalid refresh token'
      ),
  });

module.exports = {

  registerSchema,

  loginSchema,

  refreshTokenSchema,
};