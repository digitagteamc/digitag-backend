const { Router } = require('express');

const controller = require('./brand.controller');
const schemas = require('./brand.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

router.get('/profile/me', authenticate, authorize(ROLES.BRAND), controller.me);

router.get('/me/status', authenticate, authorize(ROLES.BRAND), controller.status);

router.post(
  '/profile',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.createBrandProfileSchema }),
  controller.create,
);

router.put(
  '/profile',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.updateBrandProfileSchema }),
  controller.update,
);

router.get(
  '/:id',
  authenticate,
  validateRequest({ params: idParam }),
  controller.getById,
);

module.exports = router;
