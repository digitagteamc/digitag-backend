const { Router } = require('express');
const Joi = require('joi');

const controller = require('./follow.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { uuid } = require('../../validations/common.validation');

const router = Router();

const userIdParam = Joi.object({ userId: uuid.required() });
const limitQuery = Joi.object({ limit: Joi.number().integer().min(1).max(50).optional() }).unknown(true);

router.get('/following', authenticate, controller.following);
router.get('/followers', authenticate, controller.followers);
router.get('/suggestions', authenticate, validateRequest({ query: limitQuery }), controller.suggestions);

router.get('/:userId/status', authenticate, validateRequest({ params: userIdParam }), controller.status);
router.post('/:userId', authenticate, validateRequest({ params: userIdParam }), controller.follow);
router.delete('/:userId', authenticate, validateRequest({ params: userIdParam }), controller.unfollow);

module.exports = router;
