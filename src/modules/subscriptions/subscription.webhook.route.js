const { Router } = require('express');

const controller = require('./subscription.controller');

const router = Router();

// Public — Razorpay calls this directly, authenticated only via the
// X-Razorpay-Signature HMAC (see subscription.service.js#verifyWebhookSignature),
// not a user JWT.
router.post('/razorpay', controller.webhook);

// Public — App Store Server Notifications V2. Authenticated by verifying the
// JWS signature inside signedPayload itself (Apple's cert chain), not a
// header HMAC, so no raw-body capture is needed here the way Razorpay's is.
router.post('/apple', controller.appleWebhook);

module.exports = router;
