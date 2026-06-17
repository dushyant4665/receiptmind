const express =
  require('express');

const authController =
  require('../controllers/authController');

const validateRequest =
  require('../middleware/validateRequest');

const {

  registerSchema,

  loginSchema,

  refreshTokenSchema,

} = require('../validators/authValidators');

const router =
  express.Router();

/*
  =====================================
  REGISTER
  =====================================
*/

router.post(

  '/register',

  validateRequest(
    registerSchema
  ),

  authController.register
);

/*
  =====================================
  LOGIN
  =====================================
*/

router.post(

  '/login',

  validateRequest(
    loginSchema
  ),

  authController.login
);

/*
  =====================================
  REFRESH TOKEN
  =====================================
*/

router.post(

  '/refresh',

  validateRequest(
    refreshTokenSchema
  ),

  authController.refreshToken
);

/*
  =====================================
  VERIFY EMAIL
  =====================================
*/

router.get(

  '/verify-email/:token',

  authController.verifyEmail
);

/*
  =====================================
  LOGOUT
  =====================================
*/

router.post(

  '/logout',

  authController.logout
);

module.exports =
  router;