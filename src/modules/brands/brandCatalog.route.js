const { Router } = require('express');
const Joi = require('joi');

const controller = require('./brand.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

// Admin-curated Brand Home catalogs at the top-level paths the app calls
// (/youtube-channels, /ad-types, /celebrities). Same data as GET /brands/home.

const router = Router();

const listQuery = Joi.object({
  search: Joi.string().trim().max(100).optional(),
  category: Joi.string().trim().max(100).optional(),
}).unknown(true);

router.get('/youtube-channels', authenticate, validateRequest({ query: listQuery }), controller.youtubeChannels);
router.get('/ad-types', authenticate, controller.adTypes);
router.get('/celebrities', authenticate, validateRequest({ query: listQuery }), controller.celebrities);

module.exports = router;
