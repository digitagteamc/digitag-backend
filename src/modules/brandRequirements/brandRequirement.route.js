const { Router } = require('express');

const controller = require('./brandRequirement.controller');
const schemas = require('./brandRequirement.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { ROLES } = require('../../constants/roles');

const router = Router();

router.get('/mine', authenticate, authorize(ROLES.BRAND), controller.listMine);

router.post(
  '/',
  authenticate,
  authorize(ROLES.BRAND),
  validateRequest({ body: schemas.createRequirementSchema }),
  controller.create,
);

module.exports = router;
