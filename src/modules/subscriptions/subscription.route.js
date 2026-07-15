const { Router } = require('express');

const controller = require('./subscription.controller');
const { authenticate } = require('../../middlewares/authMiddleware');

const router = Router();

router.post('/', authenticate, controller.create);
router.get('/me', authenticate, controller.me);
// iOS StoreKit purchases verify here instead of createSubscription/Razorpay —
// see appleSubscription.service.js.
router.post('/apple/verify', authenticate, controller.verifyApple);

module.exports = router;
