const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const service = require('./user.service');

const onboardingStatus = asyncHandler(async (req, res) => {
  const data = await service.getOnboardingStatus(req.user.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getUserById(req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getStats = asyncHandler(async (req, res) => {
  const data = await service.getUserStats(req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getMyStats = asyncHandler(async (req, res) => {
  const data = await service.getUserStats(req.user.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

module.exports = { onboardingStatus, getById, getStats, getMyStats };
