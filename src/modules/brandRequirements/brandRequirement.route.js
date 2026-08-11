const { Router } = require('express');

const controller = require('./brandRequirement.controller');
const schemas = require('./brandRequirement.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { ROLES } = require('../../constants/roles');

const router = Router();

router.get('/mine', authenticate, authorize(ROLES.BRAND), controller.listMine);

// "Opportunities For You" — Creator/Freelancer browsing open Brand requirements.
router.get('/open', authenticate, authorize(ROLES.CREATOR, ROLES.FREELANCER), controller.listOpen);

router.get('/:id', authenticate, authorize(ROLES.CREATOR, ROLES.FREELANCER, ROLES.BRAND), controller.getById);

router.post(
  '/',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.createRequirementSchema }),
  controller.create,
);

module.exports = router;
