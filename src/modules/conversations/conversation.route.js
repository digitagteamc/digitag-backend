const { Router } = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const controller = require('./conversation.controller');
const schemas = require('./conversation.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam, uuid } = require('../../validations/common.validation');

const msgParam = Joi.object({ id: uuid.required(), msgId: uuid.required() });

// 60 messages per minute per user — prevents spam
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Sending messages too fast, slow down.' },
});

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
router.get(
  '/:id/calls',
  authenticate,
  validateRequest({ params: idParam }),
  controller.getCallHistory,
);
router.post(
  '/:id/messages',
  authenticate,
  messageLimiter,
  validateRequest({ params: idParam, body: schemas.sendMessageSchema }),
  controller.sendMessage,
);
router.patch(
  '/:id/messages/:msgId',
  authenticate,
  validateRequest({ params: msgParam, body: schemas.editMessageSchema }),
  controller.editMessage,
);
router.delete(
  '/:id/messages/:msgId',
  authenticate,
  validateRequest({ params: msgParam }),
  controller.deleteMessage,
);

module.exports = router;
