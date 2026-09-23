const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const controller = require('./eventRegistration.controller');
const schemas = require('./eventRegistration.validation');
const { optionalAuth } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { uuid } = require('../../validations/common.validation');
const Joi = require('joi');

const ticketCodeParam = Joi.object({ ticketCode: uuid.required() });

// Public registration form is open to anyone (no login) — rate-limit hard
// since it's an open write endpoint, same convention as waitlist.route.js.
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again shortly.' },
});

const router = Router();

router.post(
  '/',
  optionalAuth,
  registerLimiter,
  validateRequest({ body: schemas.createRegistrationSchema }),
  controller.create,
);

router.get('/:ticketCode', validateRequest({ params: ticketCodeParam }), controller.getByTicketCode);
router.get('/:ticketCode/qr.png', validateRequest({ params: ticketCodeParam }), controller.getQrPng);
router.post('/:ticketCode/resend-whatsapp', validateRequest({ params: ticketCodeParam }), controller.resendWhatsapp);

module.exports = router;
