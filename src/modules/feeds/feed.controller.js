const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const service = require('./feed.service');

const getFeed = asyncHandler(async (req, res) => {
  const { items, meta } = await service.getFeed(req.user, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

module.exports = { getFeed };
