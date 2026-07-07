const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./block.service');

const block = asyncHandler(async (req, res) => {
  const data = await service.block(req.user.id, req.params.userId);
  return success(res, { statusCode: STATUS.CREATED, message: 'User blocked', data });
});

const unblock = asyncHandler(async (req, res) => {
  const data = await service.unblock(req.user.id, req.params.userId);
  return success(res, { message: 'User unblocked', data });
});

const status = asyncHandler(async (req, res) => {
  const data = await service.status(req.user.id, req.params.userId);
  return success(res, { message: 'Fetched successfully', data });
});

const listBlocked = asyncHandler(async (req, res) => {
  const data = await service.listBlocked(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

module.exports = { block, unblock, status, listBlocked };
