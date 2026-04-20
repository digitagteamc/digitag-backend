const { Router } = require('express');

const controller = require('./conversation.controller');
const schemas = require('./conversation.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

const router = Router();

router.get('/', authenticate, controller.list);
router.post('/open', authenticate, validateRequest({ body: schemas.openWithSchema }), controller.openWith);
router.get('/:id', authenticate, validateRequest({ params: idParam }), controller.getById);
router.get(
  '/:id/messages',
  authenticate,
  validateRequest({ params: idParam, query: schemas.listMessagesQuery }),
  controller.listMessages,
);
router.post(
  '/:id/messages',
  authenticate,
  validateRequest({ params: idParam, body: schemas.sendMessageSchema }),
  controller.sendMessage,
);

module.exports = router;
