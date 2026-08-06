const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const emailOtpService = require('../../services/email/emailOtp.service');

const start = asyncHandler(async (req, res) => {
  const data = await emailOtpService.startEmailVerification(req.user.id, req.body.email.trim().toLowerCase());
  return success(res, { statusCode: STATUS.CREATED, message: 'Verification code sent', data });
});

const verify = asyncHandler(async (req, res) => {
  const data = await emailOtpService.verifyEmailCode(req.user.id, req.body.id, req.body.code);
  return success(res, { message: 'Email verified', data });
});

module.exports = { start, verify };
