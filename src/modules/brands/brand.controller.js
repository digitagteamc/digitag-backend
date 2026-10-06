const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./brand.service');

const createProfile = asyncHandler(async (req, res) => {
  const data = await service.createProfile(req.user.id, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.PROFILE.CREATED, data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await service.updateProfile(req.user.id, req.body);
  return success(res, { message: MESSAGES.PROFILE.UPDATED, data });
});

const me = asyncHandler(async (req, res) => {
  const data = await service.getMyProfile(req.user.id);
  return success(res, { message: MESSAGES.PROFILE.FETCHED, data });
});

const myPosts = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listMyPosts(req.user, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const applicants = asyncHandler(async (req, res) => {
  const data = await service.listApplicants(req.user, req.params.id, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const requirements = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listRequirements(req.user, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const dashboard = asyncHandler(async (req, res) => {
  const data = await service.getDashboard(req.user);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const status = asyncHandler(async (req, res) => {
  const data = await service.getApprovalStatus(req.user.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const home = asyncHandler(async (req, res) => {
  const data = await service.getHome();
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const celebrities = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listCelebrities(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

module.exports = { createProfile, updateProfile, me, status, home, celebrities, myPosts, applicants, requirements, dashboard };
