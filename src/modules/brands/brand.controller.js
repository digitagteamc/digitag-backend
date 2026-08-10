const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const { buildProfileController } = require('../_shared/profileController');
const service = require('./brand.service');

const base = buildProfileController(service);

// buildProfileController only covers create/update/me/getById — status is
// brand-specific (no other role has an approval state to poll).
const status = asyncHandler(async (req, res) => {
  const data = await service.getMyStatus(req.user.id);
  return success(res, { message: MESSAGES.PROFILE.FETCHED, data });
});

module.exports = { ...base, status };
