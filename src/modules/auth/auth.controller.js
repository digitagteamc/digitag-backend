const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const authService = require('./auth.service');

function requestContext(req) {
  return {
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.ip,
  };
}

const sendOtp = asyncHandler(async (req, res) => {
  const result = await authService.initiateOtp(req.body);
  return success(res, { message: MESSAGES.AUTH.OTP_SENT, data: result });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.completeOtp({
    ...req.body,
    context: requestContext(req),
  });
  return success(res, { message: MESSAGES.AUTH.LOGIN_SUCCESS, data: result });
});

const refreshToken = asyncHandler(async (req, res) => {
  const tokens = await authService.refreshTokens(req.body.refreshToken, requestContext(req));
  return success(res, { message: MESSAGES.AUTH.TOKEN_REFRESHED, data: { tokens } });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  return success(res, { message: MESSAGES.AUTH.LOGOUT_SUCCESS });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return success(res, { statusCode: STATUS.OK, message: MESSAGES.GENERIC.FETCHED, data: user });
});

const switchRole = asyncHandler(async (req, res) => {
  const result = await authService.switchRole(req.user.id, req.body.role);
  return success(res, { message: 'Active role updated', data: result });
});

module.exports = { sendOtp, verifyOtp, refreshToken, logout, me, switchRole };
