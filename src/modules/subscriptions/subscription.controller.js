const asyncHandler = require('../../utils/asyncHandler');
const { success, ApiError } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const logger = require('../../utils/logger');
const service = require('./subscription.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createSubscription(req.user);
  return success(res, { statusCode: STATUS.CREATED, message: 'Subscription created', data });
});

const me = asyncHandler(async (req, res) => {
  const data = await service.getMySubscription(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

// Razorpay expects a 200 for any event it delivered successfully, regardless of what
// we did with it, or it will keep retrying. Only signature failures get rejected.
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const valid = service.verifyWebhookSignature(req.rawBody, signature);
  if (!valid) throw ApiError.unauthorized('Invalid webhook signature');

  try {
    await service.handleWebhookEvent(req.body);
  } catch (err) {
    logger.error('[razorpay webhook] handling failed', { err: err.message });
  }
  return res.status(STATUS.OK).json({ success: true });
});

module.exports = { create, me, webhook };
