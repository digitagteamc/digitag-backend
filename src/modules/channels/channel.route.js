const { Router } = require('express');

const controller = require('./channel.controller');
const schemas = require('./channel.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');
const { ROLES } = require('../../constants/roles');

const router = Router();

// Brand flow: pick a channel -> pick an ad type -> browse that channel's
// catalog -> POST /ad-requests.
router.use(authenticate, authorize(ROLES.BRAND));

// Before /:id so "ad-types" isn't parsed as a channel id.
router.get('/ad-types', controller.adTypes);
router.get('/', validateRequest({ query: schemas.listQuery }), controller.list);
router.get('/:id', validateRequest({ params: idParam }), controller.getById);
router.get('/:id/catalog', validateRequest({ params: idParam, query: schemas.catalogQuery }), controller.catalog);

module.exports = router;
