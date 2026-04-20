const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./collaboration.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createCollaboration(req.user.id, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: 'Collaboration request sent', data });
});

const list = asyncHandler(async (req, res) => {
  const data = await service.listCollaborations(req.user.id, req.query);
  return success(res, { message: 'Fetched successfully', data });
});

const respond = asyncHandler(async (req, res) => {
  const data = await service.respondToCollaboration(req.user.id, req.params.id, req.body.action);
  return success(res, { message: `Request ${data.status.toLowerCase()}`, data });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await service.cancelCollaboration(req.user.id, req.params.id);
  return success(res, { message: 'Request cancelled', data });
});

const withUser = asyncHandler(async (req, res) => {
  const data = await service.getCollaborationWith(req.user.id, req.params.userId);
  return success(res, { message: 'Fetched successfully', data });
});

module.exports = { create, list, respond, cancel, withUser };
