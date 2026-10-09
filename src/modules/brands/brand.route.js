const { Router } = require('express');

const controller = require('./brand.controller');
const schemas = require('./brand.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

// Profile (Brand only). A brand's public card is served by GET /users/:id.
router.get('/profile/me', authenticate, authorize(ROLES.BRAND), controller.me);
router.post(
  '/profile',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.createBrandProfileSchema }),
  controller.createProfile,
);
router.put(
  '/profile',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.updateBrandProfileSchema }),
  controller.updateProfile,
);

// Pending-approval screen polls this after Brand Registration.
router.get('/status', authenticate, authorize(ROLES.BRAND), controller.status);
router.get('/me/status', authenticate, authorize(ROLES.BRAND), controller.status);
router.get('/dashboard', authenticate, authorize(ROLES.BRAND), controller.dashboard);

// Brand Home tab: Top YouTube Channels, Ad Types, Celebrities (admin-managed).
// Browsing is open to pending brands too — only acting on it needs approval.
router.get('/home', authenticate, authorize(ROLES.BRAND), controller.home);
router.get(
  '/celebrities',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ query: schemas.listQuery }),
  controller.celebrities,
);

// Requirement posts are created/edited through the regular /posts endpoints
// (title, freelancerRequired / targetRoles are brand-only fields there).
router.get(
  '/posts',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ query: schemas.myPostsQuery }),
  controller.myPosts,
);
router.get(
  '/posts/:id/applicants',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ params: idParam, query: schemas.applicantsQuery }),
  controller.applicants,
);

// Brand requirement feed for Creators (all) and Freelancers (freelancer-required only).
router.get(
  '/requirements',
  authenticate,
  authorize(ROLES.CREATOR, ROLES.FREELANCER),
  validateRequest({ query: schemas.requirementsQuery }),
  controller.requirements,
);

// Public brand card. Keep last so it doesn't shadow the fixed paths above.
router.get('/:id', authenticate, validateRequest({ params: idParam }), controller.publicProfile);

module.exports = router;
