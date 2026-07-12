const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./calls.service');

const initiateCall = asyncHandler(async (req, res) => {
  const data = await service.initiateCall(req.user.id, req.body.calleeId);
  return success(res, { statusCode: STATUS.CREATED, message: 'Call initiated', data });
});

const acceptCall = asyncHandler(async (req, res) => {
  const data = await service.acceptCall(req.params.id, req.user.id);
  return success(res, { message: 'Call accepted', data });
});

const declineCall = asyncHandler(async (req, res) => {
  await service.declineCall(req.params.id, req.user.id);
  return success(res, { message: 'Call declined' });
});

const endCall = asyncHandler(async (req, res) => {
  await service.endCall(req.params.id, req.user.id);
  return success(res, { message: 'Call ended' });
});

const getCall = asyncHandler(async (req, res) => {
  const data = await service.getCall(req.params.id, req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

const registerFcmToken = asyncHandler(async (req, res) => {
  await service.registerFcmToken(req.user.id, req.body.fcmToken, req.body.platform);
  return success(res, { message: 'FCM token registered' });
});

const unregisterFcmToken = asyncHandler(async (req, res) => {
  await service.unregisterFcmToken(req.user.id, req.body.fcmToken);
  return success(res, { message: 'FCM token unregistered' });
});

module.exports = { initiateCall, acceptCall, declineCall, endCall, getCall, registerFcmToken, unregisterFcmToken };
