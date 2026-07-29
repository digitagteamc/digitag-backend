const { Router } = require('express');
const controller = require('./calls.controller');
const { authenticate } = require('../../middlewares/authMiddleware');

const router = Router();

router.use(authenticate);

router.post('/fcm-token', controller.registerFcmToken);
router.delete('/fcm-token', controller.unregisterFcmToken);
router.post('/voip-token', controller.registerVoipToken);
router.post('/initiate', controller.initiateCall);
router.get('/:id', controller.getCall);
router.post('/:id/accept', controller.acceptCall);
router.post('/:id/decline', controller.declineCall);
router.post('/:id/end', controller.endCall);

module.exports = router;
