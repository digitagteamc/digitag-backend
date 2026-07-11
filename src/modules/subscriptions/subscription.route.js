const { Router } = require('express');

const controller = require('./subscription.controller');
const { authenticate } = require('../../middlewares/authMiddleware');

const router = Router();

router.post('/', authenticate, controller.create);
router.get('/me', authenticate, controller.me);

module.exports = router;
