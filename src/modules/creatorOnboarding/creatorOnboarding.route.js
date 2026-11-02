const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const service = require('./creatorOnboarding.service');
const schemas = require('./creatorOnboarding.validation');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { validateRequest } = require('../../middlewares/validateMiddleware');

// Public form (link a telecaller sends to the creator) — no login, so
// rate-limit hard like the other open write endpoints (waitlist, events).
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again shortly.' },
});

const router = Router();

router.post(
  '/',
  submitLimiter,
  validateRequest({ body: schemas.createSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.create(req.body, { ipAddress: req.ip, userAgent: req.get('user-agent') });
    return success(res, { message: 'Thanks! Your details have been submitted.', data });
  }),
);

module.exports = router;
