const { Router } = require('express');
const controller = require('./instagram.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { startVerificationSchema, idParam, reuseAccountSchema } = require('./instagram.validation');

const router = Router();

// Authenticated: start a new verification session
router.post(
  '/start-verification',
  authenticate,
  validateRequest({ body: startVerificationSchema }),
  controller.startVerification,
);

// Authenticated: poll verification status
router.get(
  '/verification-status/:id',
  authenticate,
  validateRequest({ params: idParam }),
  controller.getStatus,
);

// Authenticated: list this user's connected (verified) Instagram accounts
router.get('/accounts', authenticate, controller.listAccounts);

// Authenticated: disconnect a connected Instagram account
router.delete(
  '/accounts/:id',
  authenticate,
  validateRequest({ params: idParam }),
  controller.removeAccount,
);

// Authenticated: check whether a sibling role-profile (same account) already
// has a verified Instagram account this user could reuse instead of a fresh DM
router.get('/reusable-account', authenticate, controller.getReusableAccount);

// Authenticated: instantly link that reused Instagram account to this user
router.post(
  '/reuse-account',
  authenticate,
  validateRequest({ body: reuseAccountSchema }),
  controller.reuseAccount,
);

// Public: Meta webhook challenge verification
router.get('/webhook', controller.webhookVerify);

// Public: Meta webhook event delivery
router.post('/webhook', controller.webhookReceive);

module.exports = router;
