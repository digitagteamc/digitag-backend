const { Router } = require('express');

const controller = require('./adRequest.controller');
const schemas = require('./adRequest.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

// Brand side of ad requests. The channel side lives under /crm.
router.use(authenticate, authorize(ROLES.BRAND));

router.post('/', validateRequest({ body: schemas.createSchema }), controller.create);
router.get('/', validateRequest({ query: schemas.listQuery }), controller.list);
router.get('/:id', validateRequest({ params: idParam }), controller.getById);
router.post('/:id/cancel', validateRequest({ params: idParam, body: schemas.cancelSchema }), controller.cancel);
router.post('/:id/notes', validateRequest({ params: idParam, body: schemas.noteSchema }), controller.addNote);

module.exports = router;
