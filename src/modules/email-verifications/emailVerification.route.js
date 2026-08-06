const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const env = require('../../config/env');
const controller = require('./emailVerification.controller');
const { validate } = require('../../middlewares/validateMiddleware');
const { authenticate } = require('../../middlewares/authMiddleware');
const { startSchema, verifySchema } = require('./emailVerification.validation');

const router = Router();

const emailOtpLimiter = rateLimit({
  windowMs: env.RATE_LIMIT.windowMs,
  max: env.RATE_LIMIT.emailOtpMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});

router.post('/start', authenticate, emailOtpLimiter, validate(startSchema), controller.start);
router.post('/verify', authenticate, emailOtpLimiter, validate(verifySchema), controller.verify);

module.exports = router;
