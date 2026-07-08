const { Router } = require('express');
const Joi = require('joi');

const controller = require('./user.controller');
const { authenticate, optionalAuth } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

const router = Router();

const tagParam = Joi.object({ tagId: Joi.string().trim().min(1).max(50).required() });

router.get('/onboarding-status', authenticate, controller.onboardingStatus);
router.get('/me/stats', authenticate, controller.getMyStats);
// Profile browsing is public (Apple 5.1.1 — viewing a creator/freelancer profile isn't
// account-based). Must be registered before /:id, otherwise "by-tag" is swallowed as an :id.
router.get('/by-tag/:tagId', optionalAuth, validateRequest({ params: tagParam }), controller.getByTag);
router.get('/:id/stats', optionalAuth, validateRequest({ params: idParam }), controller.getStats);
router.get('/:id', optionalAuth, validateRequest({ params: idParam }), controller.getById);

module.exports = router;
