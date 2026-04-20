const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');

function buildProfileController(service) {
  const create = asyncHandler(async (req, res) => {
    const data = await service.createProfile(req.user.id, req.body);
    return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.PROFILE.CREATED, data });
  });

  const update = asyncHandler(async (req, res) => {
    const data = await service.updateProfile(req.user.id, req.body);
    return success(res, { message: MESSAGES.PROFILE.UPDATED, data });
  });

  const me = asyncHandler(async (req, res) => {
    const data = await service.getMyProfile(req.user.id);
    return success(res, { message: MESSAGES.PROFILE.FETCHED, data });
  });

  const getById = asyncHandler(async (req, res) => {
    const data = await service.getProfileById(req.params.id);
    return success(res, { message: MESSAGES.PROFILE.FETCHED, data });
  });

  return { create, update, me, getById };
}

module.exports = { buildProfileController };
