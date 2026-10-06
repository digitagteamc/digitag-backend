const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./adRequest.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createAdRequest(req.user, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: 'Ad request sent', data });
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listMyAdRequests(req.user, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getMyAdRequest(req.user, req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await service.cancelByBrand(req.user, req.params.id, req.body.note || null);
  return success(res, { message: 'Ad request cancelled', data });
});

const addNote = asyncHandler(async (req, res) => {
  const data = await service.addBrandNote(req.user, req.params.id, req.body.note);
  return success(res, { message: 'Note added', data });
});

module.exports = { create, list, getById, cancel, addNote };
