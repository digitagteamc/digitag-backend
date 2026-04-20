const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const env = require('../../config/env');
const controller = require('./auth.controller');
const { validate } = require('../../middlewares/validateMiddleware');
const { authenticate } = require('../../middlewares/authMiddleware');
const schemas = require('./auth.validation');

const router = Router();

const otpLimiter = rateLimit({
  windowMs: env.RATE_LIMIT.windowMs,
  max: env.RATE_LIMIT.otpMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Try again later.' },
});

router.post('/send-otp', otpLimiter, validate(schemas.sendOtpSchema), controller.sendOtp);
router.post('/verify-otp', validate(schemas.verifyOtpSchema), controller.verifyOtp);
router.post('/refresh-token', validate(schemas.refreshTokenSchema), controller.refreshToken);
router.post('/logout', validate(schemas.logoutSchema), controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/switch-role', authenticate, validate(schemas.switchRoleSchema), controller.switchRole);

module.exports = router;
