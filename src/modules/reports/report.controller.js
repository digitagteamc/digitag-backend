const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./report.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createReport(req.user.id, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: 'Report submitted', data });
});

const status = asyncHandler(async (req, res) => {
  const data = await service.getStatus(req.user.id, req.query);
  return success(res, { message: 'Fetched successfully', data });
});

module.exports = { create, status };
