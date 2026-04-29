const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./conversation.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.listConversations(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getConversationById(req.user.id, req.params.id);
  return success(res, { message: 'Fetched successfully', data });
});

const listMessages = asyncHandler(async (req, res) => {
  const data = await service.listMessages(req.user.id, req.params.id, req.query);
  return success(res, { message: 'Fetched successfully', data: data.items, meta: { nextCursor: data.nextCursor } });
});

const sendMessage = asyncHandler(async (req, res) => {
  const data = await service.sendMessage(req.user.id, req.params.id, req.body.content);
  return success(res, { statusCode: STATUS.CREATED, message: 'Message sent', data });
});

const openWith = asyncHandler(async (req, res) => {
  const data = await service.openConversationWith(req.user.id, req.body.userId);
  return success(res, { message: 'Conversation ready', data });
});

module.exports = { list, getById, listMessages, sendMessage, openWith };
