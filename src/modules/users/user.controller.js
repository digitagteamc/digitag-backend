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

const getByTag = asyncHandler(async (req, res) => {
  const data = await service.getUserIdByTag(req.params.tagId);
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

const getPrivacySettings = asyncHandler(async (req, res) => {
  const data = await service.getPrivacySettings(req.user.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const updatePrivacySettings = asyncHandler(async (req, res) => {
  const data = await service.updatePrivacySettings(req.user.id, req.body);
  return success(res, { message: 'Settings updated', data });
});

const exportMyData = asyncHandler(async (req, res) => {
  const data = await service.exportMyData(req.user.id);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="digitag-my-data.json"');
  res.send(JSON.stringify(data, null, 2));
});

module.exports = { onboardingStatus, getByTag, getById, getStats, getMyStats, getPrivacySettings, updatePrivacySettings, exportMyData };
