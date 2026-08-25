const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authLimiter, authController.refresh);

// Email verification via OTP — primary flow
router.post('/verify-email-otp', authLimiter, authController.verifyEmailOtp);
router.post('/resend-email-otp', authLimiter, authController.resendEmailOtp);

// Legacy email verification (link-based) — kept for backward compat
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/platform-settings', authController.getPlatformBrandingSettings);

module.exports = router;

