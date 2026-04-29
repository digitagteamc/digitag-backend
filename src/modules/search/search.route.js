const { Router } = require('express');
const Joi = require('joi');

const controller = require('./search.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

const router = Router();

const searchQuery = Joi.object({
    q: Joi.string().trim().min(1).max(100).required(),
    limit: Joi.number().integer().min(1).max(50).optional(),
});

router.get('/', authenticate, validateRequest({ query: searchQuery }), controller.search);

module.exports = router;
