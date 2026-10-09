const { Router } = require('express');

const controller = require('./brandRequirement.controller');
const schemas = require('./brandRequirement.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

router.get('/mine', authenticate, authorize(ROLES.BRAND), validateRequest({ query: schemas.listQuery }), controller.listMine);

// "Opportunities For You" — Creator/Freelancer browsing open brand requirements.
router.get(
  '/open',
  authenticate,
  authorize(ROLES.CREATOR, ROLES.FREELANCER),
  validateRequest({ query: schemas.listQuery }),
  controller.listOpen,
);

router.get(
  '/:id',
  authenticate,
  authorize(ROLES.CREATOR, ROLES.FREELANCER, ROLES.BRAND),
  validateRequest({ params: idParam }),
  controller.getById,
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.createRequirementSchema }),
  controller.create,
);

module.exports = router;
