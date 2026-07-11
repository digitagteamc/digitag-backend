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
// The redirect_uri we send Google/Facebook is lowercased (see authUrl() in the service —
// it must exactly match what's registered in each provider's console), so this is the one
// place platform arrives lowercase. Accept either case and normalize to the enum's casing.
router.get('/callback/:platform', validateRequest({ params: Joi.object({ platform: platform.insensitive().uppercase() }) }), controller.callback);

module.exports = router;
