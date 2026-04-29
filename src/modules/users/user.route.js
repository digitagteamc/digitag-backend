const { Router } = require('express');

const controller = require('./user.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

const router = Router();

router.get('/onboarding-status', authenticate, controller.onboardingStatus);
router.get('/me/stats', authenticate, controller.getMyStats);
router.get('/:id/stats', authenticate, validateRequest({ params: idParam }), controller.getStats);
router.get('/:id', authenticate, validateRequest({ params: idParam }), controller.getById);

module.exports = router;
