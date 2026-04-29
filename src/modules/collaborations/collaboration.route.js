const { Router } = require('express');

const controller = require('./collaboration.controller');
const schemas = require('./collaboration.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');
const userIdParam = Joi.object({ userId: uuid.required() });

const router = Router();

router.post('/', authenticate, validateRequest({ body: schemas.createSchema }), controller.create);
router.get('/', authenticate, validateRequest({ query: schemas.listQuery }), controller.list);
router.get(
  '/with/:userId',
  authenticate,
  validateRequest({ params: userIdParam }),
  controller.withUser,
);
router.patch(
  '/:id',
  authenticate,
  validateRequest({ params: idParam, body: schemas.respondSchema }),
  controller.respond,
);
router.delete('/:id', authenticate, validateRequest({ params: idParam }), controller.cancel);

module.exports = router;
