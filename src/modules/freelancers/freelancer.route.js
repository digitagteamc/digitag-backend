const { Router } = require('express');

const controller = require('./freelancer.controller');
const schemas = require('./freelancer.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

router.get('/profile/me', authenticate, authorize(ROLES.FREELANCER), controller.me);

router.post(
  '/profile',
  authenticate,
  authorize(ROLES.FREELANCER),
  validateRequest({ body: schemas.createFreelancerProfileSchema }),
  controller.create,
);

router.put(
  '/profile',
  authenticate,
  authorize(ROLES.FREELANCER),
  validateRequest({ body: schemas.updateFreelancerProfileSchema }),
  controller.update,
);

router.get(
  '/:id',
  authenticate,
  validateRequest({ params: idParam }),
  controller.getById,
);

module.exports = router;
