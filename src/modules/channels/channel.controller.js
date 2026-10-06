const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const service = require('./channel.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listChannels(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getChannel(req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const catalog = asyncHandler(async (req, res) => {
  const data = await service.getCatalog(req.params.id, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const adTypes = asyncHandler(async (req, res) => {
  const data = await service.listAdTypes();
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

module.exports = { list, getById, catalog, adTypes };
