const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const service = require('./notification.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.listNotifications(req.user.id, req.query);
  return success(res, { message: 'Fetched successfully', data: data.items, meta: { nextCursor: data.nextCursor } });
});

const markAllRead = asyncHandler(async (req, res) => {
  const data = await service.markAllRead(req.user.id);
  return success(res, { message: 'Marked as read', data });
});

const unreadCount = asyncHandler(async (req, res) => {
  const data = await service.unreadCount(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

module.exports = { list, markAllRead, unreadCount };
