const express = require('express');
const authController = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authController.logout);

// Email verification
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/verify-email', validateRequest(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', validateRequest(resendVerificationSchema), authController.resendVerification);

// Password reset
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);

module.exports = router;