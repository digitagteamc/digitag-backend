const { Router } = require('express');

const controller = require('./subscription.controller');

const router = Router();

// Public — Razorpay calls this directly, authenticated only via the
// X-Razorpay-Signature HMAC (see subscription.service.js#verifyWebhookSignature),
// not a user JWT.
router.post('/razorpay', controller.webhook);

module.exports = router;
