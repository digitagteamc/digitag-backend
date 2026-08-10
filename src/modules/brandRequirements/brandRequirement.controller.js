const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./brandRequirement.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createRequirement(req.user.id, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});

const listMine = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listMyRequirements(req.user.id, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

module.exports = { create, listMine };
