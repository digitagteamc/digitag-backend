const { Router } = require('express');
const Joi = require('joi');

const controller = require('./feed.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { pagination, uuid } = require('../../validations/common.validation');

const router = Router();

const feedQuery = pagination.keys({
  collaborationType: Joi.string().valid('PAID', 'UNPAID').optional(),
  location: Joi.string().trim().max(120).optional(),
  search: Joi.string().trim().max(120).optional(),
  categoryId: uuid.optional(),
});

router.get('/', authenticate, validateRequest({ query: feedQuery }), controller.getFeed);

module.exports = router;
