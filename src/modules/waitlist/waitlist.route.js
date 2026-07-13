const { Router } = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const { prisma } = require('../../config/db');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { optionalAuth } = require('../../middlewares/authMiddleware');

// The "Notify Me" hero on Home is visible to guests too, so no auth is
// required — but rate-limit hard since it's an open write endpoint.
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again shortly.' },
});

const joinSchema = Joi.object({
  mobileNumber: Joi.string().pattern(/^[0-9]{10}$/).required()
    .messages({ 'string.pattern.base': 'Enter a valid 10-digit mobile number' }),
});

const router = Router();

router.post(
  '/',
  optionalAuth,
  joinLimiter,
  validateRequest({ body: joinSchema }),
  asyncHandler(async (req, res) => {
    // Upsert: joining twice is a no-op, never an error.
    await prisma.launchWaitlist.upsert({
      where: { mobileNumber: req.body.mobileNumber },
      create: { mobileNumber: req.body.mobileNumber },
      update: {},
    });
    return success(res, { message: "You're on the list — we'll notify you at launch" });
  }),
);

module.exports = router;
