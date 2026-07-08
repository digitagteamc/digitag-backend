const { Router } = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const controller = require('./feed.controller');
const { optionalAuth } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { pagination, uuid } = require('../../validations/common.validation');

// 30 feed fetches per minute — prevents infinite-scroll abuse
const feedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

const feedQuery = pagination.keys({
  collaborationType: Joi.string().valid('PAID', 'UNPAID').optional(),
  location: Joi.string().trim().max(120).optional(),
  search: Joi.string().trim().max(120).optional(),
  categoryId: uuid.optional(),
});

// Public: browsable without an account (Apple 5.1.1 — non-account-based browsing).
// Logged-in users still get their normal opposite-role feed; optionalAuth just
// means a missing/invalid token no longer blocks the request.
router.get('/', optionalAuth, feedLimiter, validateRequest({ query: feedQuery }), controller.getFeed);

module.exports = router;
