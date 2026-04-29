const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const service = require('./category.service');

const list = asyncHandler(async (req, res) => {
  const { role, search } = req.query;
  const data = await service.listCategories({ role, search });
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getCategoryById(req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

module.exports = { list, getById };
