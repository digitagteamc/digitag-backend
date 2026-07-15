const { Router } = require('express');
const Joi = require('joi');

const controller = require('./user.controller');
const { authenticate, optionalAuth } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

const router = Router();

const tagParam = Joi.object({ tagId: Joi.string().trim().min(1).max(50).required() });
const privacySettingsBody = Joi.object({
  isDiscoverable: Joi.boolean().optional(),
  showOnlineStatus: Joi.boolean().optional(),
  shareDataForPersonalization: Joi.boolean().optional(),
  pushNotificationsEnabled: Joi.boolean().optional(),
  preferredLanguage: Joi.string().trim().min(1).max(30).optional(),
}).min(1);

router.get('/onboarding-status', authenticate, controller.onboardingStatus);
router.get('/me/stats', authenticate, controller.getMyStats);
router.get('/me/privacy-settings', authenticate, controller.getPrivacySettings);
router.patch('/me/privacy-settings', authenticate, validateRequest({ body: privacySettingsBody }), controller.updatePrivacySettings);
router.get('/me/export', authenticate, controller.exportMyData);
router.get('/me/profile-viewers', authenticate, controller.getProfileViewers);
// Profile browsing is public (Apple 5.1.1 — viewing a creator/freelancer profile isn't
// account-based). Must be registered before /:id, otherwise "by-tag" is swallowed as an :id.
router.get('/by-tag/:tagId', optionalAuth, validateRequest({ params: tagParam }), controller.getByTag);
router.get('/:id/stats', optionalAuth, validateRequest({ params: idParam }), controller.getStats);
router.get('/:id', optionalAuth, validateRequest({ params: idParam }), controller.getById);

module.exports = router;
