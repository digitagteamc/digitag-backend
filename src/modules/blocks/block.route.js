const { Router } = require('express');
const Joi = require('joi');

const controller = require('./block.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { uuid } = require('../../validations/common.validation');

const router = Router();

const userIdParam = Joi.object({ userId: uuid.required() });

router.get('/', authenticate, controller.listBlocked);
router.get('/:userId/status', authenticate, validateRequest({ params: userIdParam }), controller.status);
router.post('/:userId', authenticate, validateRequest({ params: userIdParam }), controller.block);
router.delete('/:userId', authenticate, validateRequest({ params: userIdParam }), controller.unblock);

module.exports = router;
