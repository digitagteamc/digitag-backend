const { Router } = require('express');
const Joi = require('joi');
const controller = require('./socialVerification.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { uuid } = require('../../validations/common.validation');

const router = Router();
const platform = Joi.string().valid('YOUTUBE', 'FACEBOOK').required();

router.post('/start', authenticate, validateRequest({ body: Joi.object({ platform }) }), controller.start);
router.get('/status/:id', authenticate, validateRequest({ params: Joi.object({ id: uuid.required() }) }), controller.status);
router.get('/callback/:platform', validateRequest({ params: Joi.object({ platform }) }), controller.callback);

module.exports = router;
