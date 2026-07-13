const { Router } = require('express');

const controller = require('./notification.controller');
const schemas = require('./notification.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

const router = Router();

router.get('/', authenticate, validateRequest({ query: schemas.listQuery }), controller.list);
router.get('/unread-count', authenticate, controller.unreadCount);
router.post('/read-all', authenticate, controller.markAllRead);

module.exports = router;
