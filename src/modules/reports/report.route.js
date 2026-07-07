const { Router } = require('express');

const controller = require('./report.controller');
const schemas = require('./report.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

const router = Router();

router.get('/status', authenticate, validateRequest({ query: schemas.statusQuerySchema }), controller.status);
router.post('/', authenticate, validateRequest({ body: schemas.createReportSchema }), controller.create);

module.exports = router;
