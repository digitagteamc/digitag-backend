const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./follow.service');

const follow = asyncHandler(async (req, res) => {
  const data = await service.follow(req.user.id, req.params.userId);
  return success(res, { statusCode: STATUS.CREATED, message: 'Now following', data });
});

const unfollow = asyncHandler(async (req, res) => {
  const data = await service.unfollow(req.user.id, req.params.userId);
  return success(res, { message: 'Unfollowed', data });
});

const status = asyncHandler(async (req, res) => {
  const data = await service.status(req.user.id, req.params.userId);
  return success(res, { message: 'Fetched successfully', data });
});

const following = asyncHandler(async (req, res) => {
  const data = await service.listFollowing(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

const followers = asyncHandler(async (req, res) => {
  const data = await service.listFollowers(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

const suggestions = asyncHandler(async (req, res) => {
  const data = await service.listSuggestions(req.user.id, req.query);
  return success(res, { message: 'Fetched successfully', data });
});

module.exports = { follow, unfollow, status, following, followers, suggestions };
