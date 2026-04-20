const { Router } = require('express');

const controller = require('./creator.controller');
const schemas = require('./creator.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

router.get('/profile/me', authenticate, authorize(ROLES.CREATOR), controller.me);

router.post(
  '/profile',
  authenticate,
  authorize(ROLES.CREATOR),
  validateRequest({ body: schemas.createCreatorProfileSchema }),
  controller.create,
);

router.put(
  '/profile',
  authenticate,
  authorize(ROLES.CREATOR),
  validateRequest({ body: schemas.updateCreatorProfileSchema }),
  controller.update,
);

router.get(
  '/:id',
  authenticate,
  validateRequest({ params: idParam }),
  controller.getById,
);

module.exports = router;
